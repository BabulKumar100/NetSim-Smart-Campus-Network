import { inSubnet, isApipa, isPrivate, isValidIp, isValidPrefix, networkOf, sameSubnet } from './ip'
import { arp, domainFromHost, domainFromRouterInterface, getDevice } from './l2'

const MAX_ROUTER_HOPS = 16

function appendPath(run, segment) {
  for (const id of segment) {
    if (run.path[run.path.length - 1] !== id) run.path.push(id)
  }
}

function fail(run, packet, step) {
  run.steps.push({ ...step, status: 'fail' })
  return {
    ok: false,
    steps: run.steps,
    path: run.path,
    reason: step.detail,
    packet,
    routerHops: run.routerHops,
    gatewayUsed: run.gatewayUsed,
  }
}

function success(run, packet, deliveredTo, step) {
  run.steps.push({ ...step, status: 'ok' })
  return { ok: true, steps: run.steps, path: run.path, packet, deliveredTo, routerHops: run.routerHops, gatewayUsed: run.gatewayUsed }
}

function describeArpFailure(res, target, domain, state) {
  const where = domain.vlan !== null ? `VLAN ${domain.vlan}` : 'the directly connected link'
  if (res.status === 'duplicate') {
    const names = res.endpoints.map((e) => getDevice(state, e.deviceId)?.name ?? e.deviceId).join(' and ')
    return `Duplicate IP address: ${names} both answered the ARP request for ${target} in ${where}. Traffic cannot be delivered reliably until one device is re-addressed.`
  }
  if (res.status === 'offline') {
    const name = getDevice(state, res.endpoint.deviceId)?.name ?? res.endpoint.deviceId
    return `${name} owns ${target} but is powered off or its interface is shut down, so the ARP request for ${target} in ${where} gets no reply.`
  }
  if (domain.endpoints.length === 0) {
    return `The ARP broadcast for ${target} did not reach any other device. The access link, VLAN assignment or trunk path is not carrying this traffic.`
  }
  return `No device in ${where} owns ${target}, so the ARP request receives no reply (Request timed out).`
}

export function aclByName(state, name) {
  return name ? state.acls.find((a) => a.name === name) : undefined
}

export function evaluateAcl(acl, packet) {
  const rules = [...acl.rules].sort((a, b) => a.seq - b.seq)
  for (const rule of rules) {
    const protoMatch = rule.protocol === 'ip' || rule.protocol === packet.protocol
    const portMatch = rule.port === undefined || rule.protocol === 'ip' || rule.protocol === 'icmp' || rule.port === packet.dstPort
    if (protoMatch && portMatch && inSubnet(packet.srcIp, rule.src, rule.srcPrefix) && inSubnet(packet.dstIp, rule.dst, rule.dstPrefix)) {
      return { action: rule.action, rule }
    }
  }
  return { action: 'deny', rule: null }
}

export function routingTable(router) {
  const table = []
  const up = (router.interfaces ?? []).filter((f) => f.up && isValidIp(f.ip) && isValidPrefix(f.prefix))
  for (const iface of up) {
    table.push({ type: 'connected', network: networkOf(iface.ip, iface.prefix), prefix: iface.prefix, iface })
  }
  for (const route of router.routes ?? []) {
    const exit = up.find((f) => sameSubnet(f.ip, route.nextHop, f.prefix))
    if (exit && isValidIp(route.network))
      table.push({ type: 'static', network: route.network, prefix: route.prefix, iface: exit, nextHop: route.nextHop })
  }
  return table
}

export function lookupRoute(router, dstIp) {
  return routingTable(router)
    .filter((r) => inSubnet(dstIp, r.network, r.prefix))
    .sort((a, b) => b.prefix - a.prefix || (a.type === 'connected' ? -1 : 1))[0]
}

function hostSend(session, hostId, input, run) {
  const { state } = session
  const packet = { ...input }
  const host = getDevice(state, hostId)
  if (!host?.host)
    return fail(run, packet, {
      layer: 'L3',
      title: 'Invalid source',
      detail: 'The selected source is not an end device with an IP configuration.',
    })
  appendPath(run, [host.id])
  if (!host.online)
    return fail(run, packet, {
      layer: 'L1',
      deviceId: host.id,
      title: 'Source powered off',
      detail: `${host.name} is powered off in the simulation model, so it cannot send anything.`,
    })

  const cfg = host.host
  if (!isValidIp(cfg.ip)) {
    return fail(run, packet, {
      layer: 'L3',
      deviceId: host.id,
      title: 'No IP address',
      detail: `${host.name} has no valid IPv4 address${cfg.mode === 'dhcp' ? ' (DHCP has not supplied one)' : ''}.`,
    })
  }
  if (isApipa(cfg.ip)) {
    return fail(run, packet, {
      layer: 'L3',
      deviceId: host.id,
      title: 'APIPA address only',
      detail: `${host.name} is using ${cfg.ip}, a link-local (APIPA) address assigned automatically when DHCP fails. It has no default gateway and cannot reach other subnets.`,
    })
  }
  if (!isValidPrefix(cfg.prefix) || cfg.prefix === 0) {
    return fail(run, packet, {
      layer: 'L3',
      deviceId: host.id,
      title: 'Invalid subnet mask',
      detail: `${host.name} has an invalid subnet mask.`,
    })
  }

  run.steps.push({
    status: 'info',
    layer: 'L3',
    deviceId: host.id,
    title: 'Packet created',
    detail: `${host.name} builds an IP packet: source ${packet.srcIp} → destination ${packet.dstIp} (${packet.protocol.toUpperCase()}${packet.dstPort ? ` port ${packet.dstPort}` : ''}), TTL ${packet.ttl}.`,
    frame: {
      srcIp: packet.srcIp,
      dstIp: packet.dstIp,
      ttl: packet.ttl,
      protocol: packet.protocol,
      srcPort: packet.srcPort,
      dstPort: packet.dstPort,
    },
  })

  if (packet.dstIp === cfg.ip) {
    return success(
      run,
      packet,
      { deviceId: host.id },
      { layer: 'L3', deviceId: host.id, title: 'Delivered locally', detail: 'The destination is the source device itself.' },
    )
  }

  const local = sameSubnet(cfg.ip, packet.dstIp, cfg.prefix)
  let target
  if (local) {
    target = packet.dstIp
    run.steps.push({
      status: 'info',
      layer: 'L3',
      deviceId: host.id,
      title: 'Same-subnet decision',
      detail: `${cfg.ip}/${cfg.prefix} AND mask = ${networkOf(cfg.ip, cfg.prefix)}; ${packet.dstIp} gives the same network, so the destination is local. The host sends directly without using the gateway.`,
    })
  } else {
    if (!cfg.gateway)
      return fail(run, packet, {
        layer: 'L3',
        deviceId: host.id,
        title: 'No default gateway',
        detail: `${packet.dstIp} is outside ${networkOf(cfg.ip, cfg.prefix)}/${cfg.prefix}, but ${host.name} has no default gateway configured.`,
      })
    if (!isValidIp(cfg.gateway))
      return fail(run, packet, {
        layer: 'L3',
        deviceId: host.id,
        title: 'Invalid gateway',
        detail: `The default gateway "${cfg.gateway}" is not a valid IPv4 address.`,
      })
    if (!sameSubnet(cfg.gateway, cfg.ip, cfg.prefix)) {
      return fail(run, packet, {
        layer: 'L3',
        deviceId: host.id,
        title: 'Gateway outside subnet',
        detail: `Gateway ${cfg.gateway} is not inside ${host.name}'s own subnet ${networkOf(cfg.ip, cfg.prefix)}/${cfg.prefix}, so the host cannot reach it directly.`,
      })
    }
    target = cfg.gateway
    run.gatewayUsed = cfg.gateway
    run.steps.push({
      status: 'info',
      layer: 'L3',
      deviceId: host.id,
      title: 'Remote-subnet decision',
      detail: `${packet.dstIp} is not in ${networkOf(cfg.ip, cfg.prefix)}/${cfg.prefix}, so the packet must be sent to the default gateway ${cfg.gateway}.`,
    })
  }

  const domain = domainFromHost(state, host.id)
  const res = arp(domain, target, { deviceId: host.id })
  if (res.status !== 'resolved') {
    return fail(run, packet, {
      layer: 'L2',
      deviceId: host.id,
      title: `ARP for ${target} failed`,
      detail: describeArpFailure(res, target, domain, state),
    })
  }
  const ep = res.endpoint
  run.steps.push({
    status: 'ok',
    layer: 'L2',
    deviceId: host.id,
    title: `ARP resolved ${target}`,
    detail: `ARP broadcast in ${domain.vlan !== null ? `VLAN ${domain.vlan}` : 'the local segment'}: ${target} is at ${ep.mac}.`,
    frame: {
      srcMac: host.mac,
      dstMac: 'FFFF.FFFF.FFFF',
      srcIp: cfg.ip,
      dstIp: target,
      ttl: packet.ttl,
      vlan: domain.vlan,
      protocol: packet.protocol,
    },
  })
  appendPath(run, domain.pathTo(ep.deviceId))
  run.steps.push({
    status: 'ok',
    layer: 'L2',
    deviceId: ep.deviceId,
    title: 'Ethernet frame forwarded',
    detail: `Switches forward the frame by destination MAC ${ep.mac}${domain.vlan !== null ? ` inside VLAN ${domain.vlan}` : ''}${domain.bridges.length ? ` via ${domain.bridges.map((b) => getDevice(state, b)?.name ?? b).join(', ')}` : ''}.`,
    frame: {
      srcMac: host.mac,
      dstMac: ep.mac,
      srcIp: packet.srcIp,
      dstIp: packet.dstIp,
      ttl: packet.ttl,
      vlan: domain.vlan,
      protocol: packet.protocol,
      srcPort: packet.srcPort,
      dstPort: packet.dstPort,
    },
  })

  if (ep.kind === 'host') {
    if (local && ep.ip === packet.dstIp) {
      return success(
        run,
        packet,
        { deviceId: ep.deviceId },
        {
          layer: 'L3',
          deviceId: ep.deviceId,
          title: 'Delivered',
          detail: `${getDevice(state, ep.deviceId)?.name} accepts the packet addressed to ${packet.dstIp}.`,
        },
      )
    }
    return fail(run, packet, {
      layer: 'L3',
      deviceId: ep.deviceId,
      title: 'Gateway is not a router',
      detail: `${target} belongs to an end device, not a router. End devices do not forward packets for other hosts.`,
    })
  }
  return routerProcess(session, ep.deviceId, ep.iface ?? null, packet, run)
}

function routerProcess(session, routerId, ingressName, input, run) {
  const { state } = session
  const packet = { ...input }
  let currentRouter = routerId
  let ingress = ingressName

  for (let hop = 0; hop < MAX_ROUTER_HOPS; hop++) {
    const router = getDevice(state, currentRouter)
    if (!router) return fail(run, packet, { layer: 'L3', title: 'Router missing', detail: 'Router not found in model.' })
    appendPath(run, [router.id])
    const inIface = ingress ? router.interfaces?.find((f) => f.name === ingress) : undefined

    if (inIface) {
      const acl = aclByName(state, inIface.aclIn)
      if (acl) {
        const verdict = evaluateAcl(acl, packet)
        if (verdict.action === 'deny') {
          return fail(run, packet, {
            layer: 'L3',
            deviceId: router.id,
            title: `Blocked by ACL ${acl.name}`,
            detail: verdict.rule
              ? `Inbound ACL ${acl.name} on ${inIface.name} matched rule ${verdict.rule.seq} (deny ${verdict.rule.protocol} ${verdict.rule.src}/${verdict.rule.srcPrefix} → ${verdict.rule.dst}/${verdict.rule.dstPrefix})${verdict.rule.remark ? ` – ${verdict.rule.remark}` : ''}.`
              : `No rule in ACL ${acl.name} matched, so the implicit "deny any" at the end of every ACL dropped the packet.`,
          })
        }
        run.steps.push({
          status: 'info',
          layer: 'L3',
          deviceId: router.id,
          title: `ACL ${acl.name}: permitted`,
          detail: `Rule ${verdict.rule?.seq} permits this packet on ${inIface.name}.`,
        })
      }

      const nat = session.nat.get(router.id)
      if (router.natOverload && inIface.nat === 'outside' && nat && nat.outside === packet.dstIp) {
        run.steps.push({
          status: 'info',
          layer: 'L3',
          deviceId: router.id,
          title: 'NAT translation reversed',
          detail: `Reply for ${nat.outside} matched the NAT table and is translated back to the inside address ${nat.inside}.`,
        })
        packet.dstIp = nat.inside
      } else if ((router.interfaces ?? []).some((f) => f.up && f.ip === packet.dstIp)) {
        return success(
          run,
          packet,
          { deviceId: router.id, iface: inIface.name },
          {
            layer: 'L3',
            deviceId: router.id,
            title: 'Delivered to router',
            detail: `${packet.dstIp} is an address of ${router.name} itself.`,
          },
        )
      }

      packet.ttl -= 1
      run.routerHops += 1
      if (packet.ttl <= 0)
        return fail(run, packet, {
          layer: 'L3',
          deviceId: router.id,
          title: 'TTL expired',
          detail: 'TTL reached zero; the router discards the packet (ICMP Time Exceeded).',
        })
    }

    const route = lookupRoute(router, packet.dstIp)
    if (!route) {
      return fail(run, packet, {
        layer: 'L3',
        deviceId: router.id,
        title: 'No route to destination',
        detail: `${router.name} has no connected or static route that matches ${packet.dstIp} (and no default route), so it drops the packet and returns "Destination host unreachable".`,
      })
    }
    run.steps.push({
      status: 'info',
      layer: 'L3',
      deviceId: router.id,
      title: 'Routing decision',
      detail: `Longest-prefix match: ${route.network}/${route.prefix} (${route.type}${route.nextHop ? ` via ${route.nextHop}` : ''}) → exit interface ${route.iface.name}. TTL is now ${packet.ttl}.`,
    })

    if (router.natOverload && inIface?.nat === 'inside' && route.iface.nat === 'outside' && isPrivate(packet.srcIp)) {
      session.nat.set(router.id, { inside: packet.srcIp, outside: route.iface.ip })
      run.steps.push({
        status: 'info',
        layer: 'L3',
        deviceId: router.id,
        title: 'NAT overload (PAT)',
        detail: `Private source ${packet.srcIp} is translated to the public interface address ${route.iface.ip}.`,
      })
      packet.srcIp = route.iface.ip
    }

    const target = route.nextHop ?? packet.dstIp
    const domain = domainFromRouterInterface(state, router.id, route.iface)
    const res = arp(domain, target, { deviceId: router.id, iface: route.iface.name })
    if (res.status !== 'resolved') {
      return fail(run, packet, {
        layer: 'L2',
        deviceId: router.id,
        title: `ARP for ${target} failed`,
        detail: describeArpFailure(res, target, domain, state),
      })
    }
    const ep = res.endpoint
    appendPath(run, domain.pathTo(ep.deviceId))
    run.steps.push({
      status: 'ok',
      layer: 'L2',
      deviceId: router.id,
      title: 'Frame rewritten and forwarded',
      detail: `${router.name} builds a new Ethernet frame: source MAC ${router.mac} → destination MAC ${ep.mac}${domain.vlan !== null ? `, tagged for VLAN ${domain.vlan} on ${route.iface.port}` : ` on ${route.iface.port}`}. IP addresses are unchanged${route.iface.nat === 'outside' ? ' (apart from NAT)' : ''}.`,
      frame: {
        srcMac: router.mac,
        dstMac: ep.mac,
        srcIp: packet.srcIp,
        dstIp: packet.dstIp,
        ttl: packet.ttl,
        vlan: domain.vlan,
        protocol: packet.protocol,
        srcPort: packet.srcPort,
        dstPort: packet.dstPort,
      },
    })

    if (ep.kind === 'host') {
      if (ep.ip === packet.dstIp) {
        return success(
          run,
          packet,
          { deviceId: ep.deviceId },
          {
            layer: 'L3',
            deviceId: ep.deviceId,
            title: 'Delivered',
            detail: `${getDevice(state, ep.deviceId)?.name} accepts the packet addressed to ${packet.dstIp}.`,
          },
        )
      }
      return fail(run, packet, {
        layer: 'L3',
        deviceId: ep.deviceId,
        title: 'Next hop is not a router',
        detail: `${target} is an end device and will not forward the packet.`,
      })
    }
    currentRouter = ep.deviceId
    ingress = ep.iface ?? null
  }
  return fail(run, packet, { layer: 'L3', title: 'Routing loop', detail: `Packet exceeded ${MAX_ROUTER_HOPS} router hops.` })
}

const DEFAULT_TTL = 128

export function destinationIp(state, destination) {
  if ('ip' in destination) {
    const owner = state.devices.find((d) => d.host?.ip === destination.ip || d.interfaces?.some((f) => f.ip === destination.ip))
    return { ip: destination.ip.trim(), deviceId: owner?.id }
  }
  const dev = getDevice(state, destination.deviceId)
  return { ip: dev?.host?.ip ?? dev?.interfaces?.[0]?.ip ?? '', deviceId: dev?.id }
}

/** Runs a simulated end-to-end exchange (request + reply) through the network model. */
export function testConnectivity(state, req) {
  const protocol = req.protocol ?? 'icmp'
  const count = req.count ?? 4
  const src = getDevice(state, req.sourceId)
  const dst = destinationIp(state, req.destination)
  const session = { state, nat: new Map() }
  const srcIp = src?.host?.ip ?? ''
  const srcPort = protocol === 'icmp' ? undefined : 49152
  const packet = { srcIp, dstIp: dst.ip, protocol, ttl: DEFAULT_TTL, srcPort, dstPort: protocol === 'icmp' ? undefined : req.dstPort }

  const base = {
    sourceId: req.sourceId,
    destinationId: dst.deviceId,
    sourceIp: srcIp,
    destinationIp: dst.ip,
    protocol,
    dstPort: req.dstPort,
    sent: count,
  }

  if (!isValidIp(dst.ip)) {
    const forward = {
      ok: false,
      steps: [{ status: 'fail', layer: 'L3', title: 'Invalid destination', detail: `"${dst.ip}" is not a valid IPv4 address.` }],
      path: [],
      packet,
      routerHops: 0,
      reason: 'Invalid destination address.',
    }
    return { ...base, received: 0, success: false, forward, summary: forward.reason }
  }

  const forward = hostSend(session, req.sourceId, packet, { steps: [], path: [], routerHops: 0 })
  if (!forward.ok || !forward.deliveredTo) {
    return { ...base, gatewayUsed: forward.gatewayUsed, received: 0, success: false, forward, summary: forward.reason ?? 'Request failed.' }
  }

  const responder = getDevice(state, forward.deliveredTo.deviceId)
  const replyPacket = {
    srcIp: forward.packet.dstIp,
    dstIp: forward.packet.srcIp,
    protocol,
    ttl: responder.type === 'router' ? 255 : DEFAULT_TTL,
    srcPort: forward.packet.dstPort,
    dstPort: forward.packet.srcPort,
  }
  const replyRun = { steps: [], path: [], routerHops: 0 }
  replyRun.steps.push({
    status: 'info',
    layer: protocol === 'icmp' ? 'L3' : 'L4',
    deviceId: responder.id,
    title: protocol === 'icmp' ? 'Echo reply created' : 'Response created',
    detail: `${responder.name} answers ${replyPacket.dstIp} from ${replyPacket.srcIp}.`,
  })
  const reply =
    responder.type === 'router'
      ? (appendPath(replyRun, [responder.id]), routerProcess(session, responder.id, null, replyPacket, replyRun))
      : hostSend(session, responder.id, replyPacket, replyRun)

  const returnedHome = reply.ok && reply.deliveredTo?.deviceId === req.sourceId
  if (reply.ok && !returnedHome) {
    reply.ok = false
    reply.steps.push({
      status: 'fail',
      layer: 'L3',
      title: 'Reply misdelivered',
      detail: 'The reply reached a different device than the original sender.',
    })
    reply.reason = 'Reply did not return to the sender.'
  }
  const ok = reply.ok
  const links = Math.max(0, forward.path.length - 1) + Math.max(0, reply.path.length - 1)
  const rtt = ok ? Number((links * 0.2 + (forward.routerHops + reply.routerHops) * 0.5).toFixed(1)) : undefined

  return {
    ...base,
    gatewayUsed: forward.gatewayUsed,
    received: ok ? count : 0,
    success: ok,
    forward,
    reply,
    simulatedRttMs: rtt,
    replyTtl: ok ? reply.packet.ttl : undefined,
    summary: ok
      ? `Request reached ${responder.name} and the reply returned to the sender across ${forward.routerHops} router hop(s).`
      : `The request reached ${responder.name}, but the reply failed: ${reply.reason}`,
  }
}

/** Ping from a host to its own default gateway: used as the basis for status indicators. */
export function gatewayReachable(state, hostId) {
  const dev = getDevice(state, hostId)
  if (!dev?.host || !isValidIp(dev.host.gateway)) return false
  return testConnectivity(state, { sourceId: hostId, destination: { ip: dev.host.gateway }, count: 1 }).success
}
