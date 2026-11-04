import { rawCampusConfig } from './default-config'
import { isAlignedNetwork, isApipa, isBroadcastAddress, isNetworkAddress, isValidIp, isValidPrefix, inSubnet, subnetsOverlap } from './ip'
import { getDevice, hostLink } from './l2'
import { requestDhcp } from './services'

/** Builds the campus network and lets every DHCP client obtain its lease through the simulated DORA exchange. */
export function createInitialState() {
  let state = rawCampusConfig()
  for (const dev of state.devices) {
    if (dev.host?.mode === 'dhcp') state = requestDhcp(state, dev.id).state
  }
  return state
}

export function segmentFor(state, device) {
  return state.segments.find((s) => s.id === device.zone)
}

export function hostDevices(state) {
  return state.devices.filter((d) => d.host)
}

export function validateNetwork(state) {
  const issues = []
  const push = (i) => issues.push(i)
  const r1 = getDevice(state, state.dhcp.serverDeviceId)

  state.segments.forEach((seg, i) => {
    if (!isValidIp(seg.network))
      push({
        severity: 'error',
        category: 'subnet',
        subject: seg.short,
        message: `Network address ${seg.network} is not a valid IPv4 address.`,
      })
    else if (!isValidPrefix(seg.prefix) || seg.prefix < 8 || seg.prefix > 30)
      push({ severity: 'error', category: 'subnet', subject: seg.short, message: `Prefix /${seg.prefix} is not a valid host subnet mask.` })
    else if (!isAlignedNetwork(seg.network, seg.prefix))
      push({
        severity: 'error',
        category: 'subnet',
        subject: seg.short,
        message: `${seg.network} is not the network address for a /${seg.prefix}.`,
      })
    if (!inSubnet(seg.gateway, seg.network, seg.prefix))
      push({
        severity: 'error',
        category: 'gateway',
        subject: seg.short,
        message: `Gateway ${seg.gateway} is outside ${seg.network}/${seg.prefix}.`,
      })
    else if (isNetworkAddress(seg.gateway, seg.prefix) || isBroadcastAddress(seg.gateway, seg.prefix))
      push({
        severity: 'error',
        category: 'gateway',
        subject: seg.short,
        message: `Gateway ${seg.gateway} is the network or broadcast address.`,
      })
    state.segments.slice(i + 1).forEach((other) => {
      if (isValidIp(seg.network) && isValidIp(other.network) && subnetsOverlap(seg.network, seg.prefix, other.network, other.prefix)) {
        push({
          severity: 'error',
          category: 'subnet',
          subject: `${seg.short}/${other.short}`,
          message: `${seg.network}/${seg.prefix} overlaps ${other.network}/${other.prefix}.`,
        })
      }
      if (seg.vlan === other.vlan)
        push({
          severity: 'error',
          category: 'vlan',
          subject: `${seg.short}/${other.short}`,
          message: `Both segments use VLAN ${seg.vlan}.`,
        })
    })
    const sub = r1?.interfaces?.find((f) => f.vlan === seg.vlan)
    if (!sub)
      push({
        severity: 'error',
        category: 'routing',
        subject: seg.short,
        message: `R1 has no subinterface for VLAN ${seg.vlan}; this subnet cannot be routed.`,
      })
    else {
      if (sub.ip !== seg.gateway || sub.prefix !== seg.prefix)
        push({
          severity: 'error',
          category: 'gateway',
          subject: seg.short,
          message: `R1 ${sub.name} is ${sub.ip}/${sub.prefix} but the planned gateway is ${seg.gateway}/${seg.prefix}.`,
        })
      if (!sub.up)
        push({ severity: 'warning', category: 'routing', subject: seg.short, message: `R1 ${sub.name} is administratively down.` })
    }
  })

  const owners = new Map()
  for (const d of state.devices) {
    if (d.host && isValidIp(d.host.ip)) owners.set(d.host.ip, [...(owners.get(d.host.ip) ?? []), d.name])
    for (const f of d.interfaces ?? []) owners.set(f.ip, [...(owners.get(f.ip) ?? []), `${d.name} ${f.name}`])
  }
  for (const [ip, names] of owners) {
    if (names.length > 1)
      push({ severity: 'error', category: 'address', subject: ip, message: `Duplicate IP address ${ip} used by ${names.join(', ')}.` })
  }

  for (const d of state.devices) {
    if (!d.host) continue
    const h = d.host
    const seg = segmentFor(state, d)
    if (!h.ip) {
      push({ severity: 'warning', category: 'address', subject: d.name, message: 'No IP address assigned.' })
      continue
    }
    if (!isValidIp(h.ip)) {
      push({ severity: 'error', category: 'address', subject: d.name, message: `"${h.ip}" is not a valid IPv4 address.` })
      continue
    }
    if (isApipa(h.ip)) {
      push({ severity: 'error', category: 'dhcp', subject: d.name, message: `${h.ip} is an APIPA address – DHCP did not succeed.` })
      continue
    }
    if (!isValidPrefix(h.prefix) || h.prefix === 0) {
      push({ severity: 'error', category: 'address', subject: d.name, message: 'Invalid subnet mask.' })
      continue
    }
    if (isNetworkAddress(h.ip, h.prefix))
      push({
        severity: 'error',
        category: 'address',
        subject: d.name,
        message: `${h.ip} is the network address of its subnet and cannot be assigned to a host.`,
      })
    if (isBroadcastAddress(h.ip, h.prefix))
      push({
        severity: 'error',
        category: 'address',
        subject: d.name,
        message: `${h.ip} is the broadcast address of its subnet and cannot be assigned to a host.`,
      })
    if (seg) {
      if (!inSubnet(h.ip, seg.network, seg.prefix))
        push({
          severity: 'error',
          category: 'address',
          subject: d.name,
          message: `${h.ip} is not inside the ${seg.short} subnet ${seg.network}/${seg.prefix}.`,
        })
      if (h.prefix !== seg.prefix)
        push({
          severity: 'error',
          category: 'address',
          subject: d.name,
          message: `Mask /${h.prefix} does not match the ${seg.short} plan (/${seg.prefix}).`,
        })
      if (h.gateway !== seg.gateway)
        push({
          severity: 'error',
          category: 'gateway',
          subject: d.name,
          message: `Default gateway ${h.gateway || '(none)'} should be ${seg.gateway}.`,
        })
      const link = hostLink(state, d.id)
      const ap =
        link && link.mode === 'wireless'
          ? state.links.find(
              (l) =>
                l.mode === 'access' &&
                (l.a.device === (link.a.device === d.id ? link.b.device : link.a.device) ||
                  l.b.device === (link.a.device === d.id ? link.b.device : link.a.device)),
            )
          : undefined
      const vlan = link?.mode === 'access' ? link.vlan : ap?.vlan
      if (vlan !== undefined && vlan !== seg.vlan)
        push({
          severity: 'error',
          category: 'vlan',
          subject: d.name,
          message: `Switch port is in VLAN ${vlan}, but ${seg.short} devices belong to VLAN ${seg.vlan}.`,
        })
    } else if (h.gateway && !inSubnet(h.gateway, h.ip, h.prefix)) {
      push({ severity: 'error', category: 'gateway', subject: d.name, message: `Gateway ${h.gateway} is outside the host subnet.` })
    }
  }

  for (const link of state.links.filter((l) => l.mode === 'trunk')) {
    const sw = getDevice(state, link.b.device)
    const zoneSeg = sw ? segmentFor(state, sw) : undefined
    if (zoneSeg && !(link.allowedVlans ?? []).includes(zoneSeg.vlan)) {
      push({
        severity: 'error',
        category: 'vlan',
        subject: `${link.a.device} ${link.a.port}`,
        message: `Trunk to ${sw?.name} does not allow VLAN ${zoneSeg.vlan}.`,
      })
    }
    if (link.a.device === 'R1' || link.b.device === 'R1') {
      for (const seg of state.segments) {
        if (!(link.allowedVlans ?? []).includes(seg.vlan))
          push({
            severity: 'error',
            category: 'vlan',
            subject: 'R1 trunk',
            message: `Router trunk does not allow VLAN ${seg.vlan} (${seg.short}).`,
          })
      }
    }
  }

  for (const pool of state.dhcp.pools) {
    const seg = state.segments.find((s) => s.network === pool.network)
    if (!seg) {
      push({
        severity: 'error',
        category: 'dhcp',
        subject: pool.name,
        message: `Pool network ${pool.network}/${pool.prefix} does not match any planned subnet.`,
      })
      continue
    }
    if (pool.prefix !== seg.prefix)
      push({
        severity: 'error',
        category: 'dhcp',
        subject: pool.name,
        message: `Pool mask /${pool.prefix} differs from the subnet /${seg.prefix}.`,
      })
    if (pool.defaultRouter !== seg.gateway)
      push({
        severity: 'error',
        category: 'dhcp',
        subject: pool.name,
        message: `Pool default-router ${pool.defaultRouter} should be ${seg.gateway}.`,
      })
    const dnsServer = getDevice(state, state.dns.serverDeviceId)
    if (pool.dnsServer !== dnsServer?.host?.ip)
      push({
        severity: 'error',
        category: 'dhcp',
        subject: pool.name,
        message: `Pool dns-server ${pool.dnsServer} is not the campus DNS server (${dnsServer?.host?.ip}).`,
      })
    if (!inSubnet(pool.excludedStart, seg.network, seg.prefix) || !inSubnet(pool.excludedEnd, seg.network, seg.prefix))
      push({ severity: 'warning', category: 'dhcp', subject: pool.name, message: 'Excluded range lies outside the pool subnet.' })
  }
  if (!state.dhcp.enabled) push({ severity: 'warning', category: 'dhcp', subject: 'DHCP', message: 'DHCP service on R1 is disabled.' })

  for (const rec of state.dns.records) {
    const target = state.devices.find((d) => d.host?.ip === rec.value)
    if (!target)
      push({
        severity: 'warning',
        category: 'dns',
        subject: rec.name,
        message: `A record points to ${rec.value}, which no device currently uses.`,
      })
  }
  if (!state.dns.enabled) push({ severity: 'warning', category: 'dns', subject: 'DNS', message: 'DNS service on SRV-CORE is disabled.' })

  return issues
}
