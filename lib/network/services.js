import { intToIp, ipToInt, inSubnet, isValidIp, subnetInfo } from './ip'
import { domainFromHost, getDevice } from './l2'
import { testConnectivity } from './engine'

function apipaFor(mac) {
  const hex = mac.replace(/\./g, '')
  const a = (parseInt(hex.slice(-4, -2), 16) % 254) + 1
  const b = (parseInt(hex.slice(-2), 16) % 254) + 1
  return `169.254.${a}.${b}`
}

export function nextFreeAddress(state, pool, forDeviceId) {
  const info = subnetInfo(pool.network, pool.prefix)
  if (!info?.firstUsable || !info.lastUsable) return null
  const start = ipToInt(info.firstUsable)
  const end = ipToInt(info.lastUsable)
  const exStart = ipToInt(pool.excludedStart)
  const exEnd = ipToInt(pool.excludedEnd)
  const used = new Set()
  for (const d of state.devices) {
    if (d.id !== forDeviceId && d.host && isValidIp(d.host.ip)) used.add(d.host.ip)
    for (const f of d.interfaces ?? []) used.add(f.ip)
  }
  for (const l of state.dhcp.leases) if (l.deviceId !== forDeviceId) used.add(l.ip)
  for (let v = start; v <= end; v++) {
    if (exStart !== null && exEnd !== null && v >= exStart && v <= exEnd) continue
    const ip = intToIp(v)
    if (ip === pool.defaultRouter || used.has(ip)) continue
    return ip
  }
  return null
}

/** Simulates the DORA exchange for a DHCP client and returns the updated network state. */
export function requestDhcp(input, deviceId) {
  const state = structuredClone(input)
  const dev = getDevice(state, deviceId)
  const steps = []
  const serverDev = getDevice(state, state.dhcp.serverDeviceId)
  const pending = (names) =>
    names.forEach((name) =>
      steps.push({
        name,
        status: 'skipped',
        from: '',
        to: '',
        srcIp: '',
        dstIp: '',
        srcMac: '',
        dstMac: '',
        ports: '',
        detail: 'Not reached.',
      }),
    )

  if (!dev?.host) return { ok: false, state: input, steps, reason: 'Selected device is not a DHCP-capable end device.' }
  if (dev.host.mode !== 'dhcp')
    return { ok: false, state: input, steps, reason: `${dev.name} uses a static IP configuration. Switch it to DHCP first.` }

  const failWith = (reason) => {
    dev.host = { ...dev.host, ip: apipaFor(dev.mac), prefix: 16, gateway: '', dns: '' }
    state.dhcp.leases = state.dhcp.leases.filter((l) => l.deviceId !== deviceId)
    return { ok: false, state, steps, reason: `${reason} ${dev.name} falls back to the APIPA address ${dev.host.ip}/16.` }
  }

  if (!dev.online) return { ok: false, state: input, steps, reason: `${dev.name} is powered off.` }

  const domain = domainFromHost(state, deviceId)
  const serverEndpoint = domain.endpoints.find((e) => e.deviceId === state.dhcp.serverDeviceId && e.online)
  const discover = {
    name: 'Discover',
    status: 'ok',
    from: dev.name,
    to: 'Broadcast',
    srcIp: '0.0.0.0',
    dstIp: '255.255.255.255',
    srcMac: dev.mac,
    dstMac: 'FFFF.FFFF.FFFF',
    ports: 'UDP 68 → 67',
    detail: `${dev.name} has no address yet, so it broadcasts a DHCPDISCOVER to every device in its broadcast domain${domain.vlan !== null ? ` (VLAN ${domain.vlan})` : ''}.`,
  }

  if (!serverEndpoint || !serverDev) {
    discover.status = 'fail'
    discover.detail +=
      ' No DHCP server interface is reachable in this broadcast domain (check the access port VLAN, trunk and router subinterface).'
    steps.push(discover)
    pending(['Offer', 'Request', 'Acknowledge'])
    return failWith('No DHCP server answered the broadcast.')
  }
  if (!state.dhcp.enabled) {
    discover.status = 'fail'
    discover.detail += ` The broadcast reaches ${serverDev.name}, but its DHCP service is disabled.`
    steps.push(discover)
    pending(['Offer', 'Request', 'Acknowledge'])
    return failWith('DHCP service unavailable.')
  }
  steps.push(discover)

  const pool = state.dhcp.pools.find((p) => inSubnet(serverEndpoint.ip, p.network, p.prefix) && p.prefix === serverEndpoint.prefix)
  if (!pool) {
    steps.push({
      name: 'Offer',
      status: 'fail',
      from: serverDev.name,
      to: dev.name,
      srcIp: serverEndpoint.ip,
      dstIp: '',
      srcMac: serverDev.mac,
      dstMac: dev.mac,
      ports: 'UDP 67 → 68',
      detail: `${serverDev.name} received the request on ${serverEndpoint.iface} (${serverEndpoint.ip}) but has no pool for that subnet.`,
    })
    pending(['Request', 'Acknowledge'])
    return failWith('No matching DHCP pool.')
  }

  const existing = state.dhcp.leases.find((l) => l.deviceId === deviceId && l.poolId === pool.id)
  const takenByOther = (ip) => state.devices.some((d) => d.id !== deviceId && (d.host?.ip === ip || d.interfaces?.some((f) => f.ip === ip)))
  const offerIp = existing && !takenByOther(existing.ip) ? existing.ip : nextFreeAddress(state, pool, deviceId)
  if (!offerIp) {
    steps.push({
      name: 'Offer',
      status: 'fail',
      from: serverDev.name,
      to: dev.name,
      srcIp: serverEndpoint.ip,
      dstIp: '',
      srcMac: serverDev.mac,
      dstMac: dev.mac,
      ports: 'UDP 67 → 68',
      detail: `Pool ${pool.name} has no free addresses.`,
    })
    pending(['Request', 'Acknowledge'])
    return failWith('DHCP pool exhausted.')
  }

  steps.push({
    name: 'Offer',
    status: 'ok',
    from: serverDev.name,
    to: dev.name,
    srcIp: serverEndpoint.ip,
    dstIp: '255.255.255.255',
    srcMac: serverDev.mac,
    dstMac: dev.mac,
    ports: 'UDP 67 → 68',
    detail: `Pool ${pool.name} offers ${offerIp}/${pool.prefix}, gateway ${pool.defaultRouter}, DNS ${pool.dnsServer}. Addresses ${pool.excludedStart}–${pool.excludedEnd} are excluded (reserved for static use).`,
  })
  steps.push({
    name: 'Request',
    status: 'ok',
    from: dev.name,
    to: 'Broadcast',
    srcIp: '0.0.0.0',
    dstIp: '255.255.255.255',
    srcMac: dev.mac,
    dstMac: 'FFFF.FFFF.FFFF',
    ports: 'UDP 68 → 67',
    detail: `${dev.name} broadcasts a DHCPREQUEST for ${offerIp}, telling every server which offer it accepted.`,
  })
  steps.push({
    name: 'Acknowledge',
    status: 'ok',
    from: serverDev.name,
    to: dev.name,
    srcIp: serverEndpoint.ip,
    dstIp: '255.255.255.255',
    srcMac: serverDev.mac,
    dstMac: dev.mac,
    ports: 'UDP 67 → 68',
    detail: `${serverDev.name} confirms the lease. ${dev.name} now configures ${offerIp}/${pool.prefix}.`,
  })

  const lease = { ip: offerIp, mac: dev.mac, deviceId, poolId: pool.id }
  state.dhcp.leases = [...state.dhcp.leases.filter((l) => l.deviceId !== deviceId), lease]
  dev.host = { ...dev.host, ip: offerIp, prefix: pool.prefix, gateway: pool.defaultRouter, dns: pool.dnsServer }
  return { ok: true, state, steps, lease, pool }
}

export function releaseDhcp(input, deviceId) {
  const state = structuredClone(input)
  const dev = getDevice(state, deviceId)
  if (dev?.host?.mode === 'dhcp') dev.host = { ...dev.host, ip: '', prefix: 0, gateway: '', dns: '' }
  state.dhcp.leases = state.dhcp.leases.filter((l) => l.deviceId !== deviceId)
  return state
}

export function normalizeName(name) {
  return name.trim().toLowerCase().replace(/\.$/, '')
}

const NAME_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/

/** Simulated DNS lookup: a real UDP/53 query is modelled through the network engine, then the server's local record table is consulted. */
export function dnsLookup(state, clientId, rawName) {
  const name = normalizeName(rawName)
  const base = { name, recordType: 'A' }
  if (!NAME_RE.test(name)) return { ...base, status: 'invalid-name', explanation: `"${rawName}" is not a valid host name.` }

  const client = getDevice(state, clientId)
  const server = client?.host?.dns
  if (!client?.host || !server || !isValidIp(server)) {
    return {
      ...base,
      status: 'no-dns-configured',
      explanation: `${client?.name ?? 'The client'} has no DNS server configured, so it cannot ask anyone to resolve the name.`,
    }
  }

  const query = testConnectivity(state, { sourceId: clientId, destination: { ip: server }, protocol: 'udp', dstPort: 53, count: 1 })
  if (!query.success) {
    return {
      ...base,
      status: 'server-unreachable',
      dnsServer: server,
      query,
      explanation: `The DNS query (UDP port 53) to ${server} could not complete: ${query.summary}`,
    }
  }
  if (query.destinationId !== state.dns.serverDeviceId) {
    const owner = getDevice(state, query.destinationId ?? '')
    return {
      ...base,
      status: 'server-not-dns',
      dnsServer: server,
      query,
      explanation: `${server} (${owner?.name ?? 'unknown device'}) is reachable but does not run the DNS service.`,
    }
  }
  if (!state.dns.enabled) {
    return {
      ...base,
      status: 'service-disabled',
      dnsServer: server,
      query,
      explanation: `The DNS service on ${getDevice(state, state.dns.serverDeviceId)?.name} is turned off, so the query is not answered.`,
    }
  }
  const record = state.dns.records.find((r) => normalizeName(r.name) === name && r.type === 'A')
  if (!record) {
    return {
      ...base,
      status: 'nxdomain',
      dnsServer: server,
      query,
      explanation: `The DNS server answered, but it has no A record for ${name} (NXDOMAIN – name does not exist).`,
    }
  }
  return {
    ...base,
    status: 'resolved',
    address: record.value,
    dnsServer: server,
    query,
    explanation: `${server} returned an A record: ${name} → ${record.value}. The client can now open a connection to that IP address.`,
  }
}
