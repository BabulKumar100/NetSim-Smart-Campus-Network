import { isValidIp } from './ip'

export function getDevice(state, id) {
  return state.devices.find((d) => d.id === id)
}

export function linksOf(state, deviceId) {
  return state.links.filter((l) => l.a.device === deviceId || l.b.device === deviceId)
}

export function hostLink(state, deviceId) {
  return linksOf(state, deviceId)[0]
}

function otherEnd(link, deviceId) {
  return link.a.device === deviceId ? link.b : link.a
}

function isHostType(d) {
  return d.type === 'pc' || d.type === 'server' || d.type === 'wireless'
}

/** 'u' means an untagged frame; a number is the VLAN the frame belongs to inside a switch. */
function crossLink(state, link, fromDevice, ctx) {
  if (!link.up) return null
  switch (link.mode) {
    case 'trunk':
      return typeof ctx === 'number' && (link.allowedVlans ?? []).includes(ctx) ? ctx : null
    case 'access': {
      const fromDev = getDevice(state, fromDevice)
      if (fromDev?.type === 'switch') return ctx === link.vlan ? 'u' : null
      return ctx === 'u' && typeof link.vlan === 'number' ? link.vlan : null
    }
    case 'direct':
    case 'wireless':
      return ctx === 'u' ? 'u' : null
  }
}

function explore(state, startDevice, startLinks, startCtx) {
  const parents = new Map()
  const endpoints = []
  const bridges = []
  const seen = new Set([`${startDevice}|${startCtx}`])
  let vlan = null
  const queue = [{ device: startDevice, ctx: startCtx, links: startLinks }]

  while (queue.length > 0) {
    const node = queue.shift()
    for (const link of node.links) {
      const next = crossLink(state, link, node.device, node.ctx)
      if (next === null) continue
      const far = otherEnd(link, node.device)
      const dev = getDevice(state, far.device)
      if (!dev) continue
      if (typeof next === 'number' && vlan === null) vlan = next
      if (!parents.has(dev.id) && dev.id !== startDevice) parents.set(dev.id, node.device)

      if (dev.type === 'switch' || dev.type === 'ap') {
        const bridgeOk = dev.type === 'switch' ? typeof next === 'number' : next === 'u'
        const key = `${dev.id}|${next}`
        if (!bridgeOk || !dev.online || seen.has(key)) continue
        seen.add(key)
        if (!bridges.includes(dev.id)) bridges.push(dev.id)
        queue.push({ device: dev.id, ctx: next, links: linksOf(state, dev.id).filter((l) => l.id !== link.id) })
      } else if (dev.type === 'router') {
        const iface = dev.interfaces?.find((f) => f.port === far.port && (next === 'u' ? f.vlan === undefined : f.vlan === next))
        if (!iface) continue
        endpoints.push({
          kind: 'router',
          deviceId: dev.id,
          iface: iface.name,
          ip: iface.ip,
          prefix: iface.prefix,
          mac: dev.mac,
          online: dev.online && iface.up,
        })
      } else if (isHostType(dev) && next === 'u' && dev.host) {
        endpoints.push({ kind: 'host', deviceId: dev.id, ip: dev.host.ip, prefix: dev.host.prefix, mac: dev.mac, online: dev.online })
      }
    }
  }

  const pathTo = (deviceId) => {
    const path = [deviceId]
    let cur = deviceId
    let guard = 0
    while (cur !== startDevice && parents.has(cur) && guard++ < 64) {
      cur = parents.get(cur)
      path.unshift(cur)
    }
    return path
  }

  return { vlan, endpoints, bridges, pathTo }
}

export function domainFromHost(state, hostId) {
  const dev = getDevice(state, hostId)
  if (!dev || !dev.online) return { vlan: null, endpoints: [], bridges: [], pathTo: (id) => [id] }
  return explore(state, hostId, linksOf(state, hostId), 'u')
}

export function domainFromRouterInterface(state, routerId, iface) {
  const dev = getDevice(state, routerId)
  if (!dev || !dev.online || !iface.up) return { vlan: null, endpoints: [], bridges: [], pathTo: (id) => [id] }
  const links = linksOf(state, routerId).filter((l) => (l.a.device === routerId ? l.a.port : l.b.port) === iface.port)
  return explore(state, routerId, links, iface.vlan ?? 'u')
}

/** Simulates an ARP request for `targetIp` broadcast inside `domain`. */
export function arp(domain, targetIp, requester) {
  if (!isValidIp(targetIp)) return { status: 'none' }
  const matches = domain.endpoints.filter((e) => e.ip === targetIp && !(e.deviceId === requester.deviceId && e.iface === requester.iface))
  const online = matches.filter((m) => m.online)
  if (online.length > 1) return { status: 'duplicate', endpoints: online }
  if (online.length === 1) return { status: 'resolved', endpoint: online[0] }
  if (matches.length > 0) return { status: 'offline', endpoint: matches[0] }
  return { status: 'none' }
}
