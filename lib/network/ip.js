export function ipToInt(ip) {
  if (typeof ip !== 'string') return null
  const parts = ip.trim().split('.')
  if (parts.length !== 4) return null
  let value = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    if (part.length > 1 && part.startsWith('0')) return null
    const n = Number(part)
    if (n < 0 || n > 255) return null
    value = value * 256 + n
  }
  return value >>> 0
}

export function intToIp(value) {
  const v = value >>> 0
  return [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255].join('.')
}

export function isValidIp(ip) {
  return ipToInt(ip) !== null
}

export function isValidPrefix(prefix) {
  return Number.isInteger(prefix) && prefix >= 0 && prefix <= 32
}

export function prefixToMaskInt(prefix) {
  if (prefix === 0) return 0
  return (0xffffffff << (32 - prefix)) >>> 0
}

export function prefixToMask(prefix) {
  return intToIp(prefixToMaskInt(prefix))
}

export function prefixToWildcard(prefix) {
  return intToIp(~prefixToMaskInt(prefix) >>> 0)
}

/** Returns the prefix length for a contiguous dotted-decimal mask, or null if the mask is invalid. */
export function maskToPrefix(mask) {
  const m = ipToInt(mask)
  if (m === null) return null
  const inverted = ~m >>> 0
  // A valid mask's inverse is of the form 0...01...1, so inverted + 1 is a power of two.
  if (((inverted + 1) & inverted) >>> 0 !== 0) return null
  let prefix = 0
  for (let bit = 31; bit >= 0; bit--) {
    if ((m >>> bit) & 1) prefix++
    else break
  }
  return prefix
}

export function networkInt(ip, prefix) {
  const v = ipToInt(ip)
  if (v === null || !isValidPrefix(prefix)) return null
  return (v & prefixToMaskInt(prefix)) >>> 0
}

export function networkOf(ip, prefix) {
  const n = networkInt(ip, prefix)
  return n === null ? null : intToIp(n)
}

export function inSubnet(ip, network, prefix) {
  const a = networkInt(ip, prefix)
  const b = networkInt(network, prefix)
  return a !== null && b !== null && a === b
}

export function sameSubnet(a, b, prefix) {
  return inSubnet(a, b, prefix)
}

export function subnetInfo(address, prefix) {
  const net = networkInt(address, prefix)
  if (net === null) return null
  const total = 2 ** (32 - prefix)
  const broadcast = (net + total - 1) >>> 0
  let first
  let last
  let usable
  if (prefix === 32) {
    first = net
    last = net
    usable = 1
  } else if (prefix === 31) {
    // RFC 3021 point-to-point links: both addresses usable, no broadcast.
    first = net
    last = broadcast
    usable = 2
  } else {
    first = net + 1
    last = broadcast - 1
    usable = total - 2
  }
  return {
    network: intToIp(net),
    prefix,
    mask: prefixToMask(prefix),
    wildcard: prefixToWildcard(prefix),
    firstUsable: first === null ? null : intToIp(first),
    lastUsable: last === null ? null : intToIp(last),
    broadcast: intToIp(broadcast),
    totalAddresses: total,
    usableHosts: usable,
  }
}

export function isNetworkAddress(ip, prefix) {
  if (prefix >= 31) return false
  const v = ipToInt(ip)
  const n = networkInt(ip, prefix)
  return v !== null && v === n
}

export function isBroadcastAddress(ip, prefix) {
  if (prefix >= 31) return false
  const info = subnetInfo(ip, prefix)
  return info !== null && info.broadcast === ip.trim()
}

export function isUsableHost(ip, prefix) {
  return isValidIp(ip) && isValidPrefix(prefix) && !isNetworkAddress(ip, prefix) && !isBroadcastAddress(ip, prefix)
}

export function isApipa(ip) {
  return inSubnet(ip, '169.254.0.0', 16)
}

export function isPrivate(ip) {
  return inSubnet(ip, '10.0.0.0', 8) || inSubnet(ip, '172.16.0.0', 12) || inSubnet(ip, '192.168.0.0', 16)
}

export function subnetsOverlap(aNet, aPrefix, bNet, bPrefix) {
  const shorter = Math.min(aPrefix, bPrefix)
  return inSubnet(aNet, bNet, shorter)
}

export function isAlignedNetwork(network, prefix) {
  return networkOf(network, prefix) === network.trim()
}

/** Smallest prefix whose usable host count covers `hosts` (conventional subnets, /30 or larger). */
export function prefixForHosts(hosts) {
  if (!Number.isInteger(hosts) || hosts < 1) return null
  for (let prefix = 30; prefix >= 0; prefix--) {
    if (2 ** (32 - prefix) - 2 >= hosts) return prefix
  }
  return null
}

export function calculateVlsm(baseNetwork, basePrefix, requests) {
  if (!isValidIp(baseNetwork)) return { ok: false, error: `"${baseNetwork}" is not a valid IPv4 address.` }
  if (!isValidPrefix(basePrefix) || basePrefix > 30) return { ok: false, error: 'Base prefix must be between /0 and /30.' }
  if (!isAlignedNetwork(baseNetwork, basePrefix)) {
    return {
      ok: false,
      error: `${baseNetwork}/${basePrefix} is not a network address. Did you mean ${networkOf(baseNetwork, basePrefix)}/${basePrefix}?`,
    }
  }
  if (requests.length === 0) return { ok: false, error: 'Add at least one department requirement.' }

  const sorted = requests
    .map((r, index) => ({ ...r, index, prefix: prefixForHosts(r.hosts) }))
    .sort((a, b) => b.hosts - a.hosts || a.index - b.index)

  const baseStart = networkInt(baseNetwork, basePrefix)
  const baseEnd = baseStart + 2 ** (32 - basePrefix)
  let cursor = baseStart
  const allocations = []

  for (const req of sorted) {
    if (req.prefix === null) return { ok: false, error: `"${req.name}" needs a positive whole number of hosts.` }
    if (req.prefix < basePrefix)
      return { ok: false, error: `"${req.name}" needs ${req.hosts} hosts, which does not fit inside /${basePrefix}.` }
    const size = 2 ** (32 - req.prefix)
    // Largest-first allocation keeps every block naturally aligned; align defensively anyway.
    cursor = Math.ceil(cursor / size) * size
    if (cursor + size > baseEnd) {
      return { ok: false, error: `Not enough address space in ${baseNetwork}/${basePrefix} for "${req.name}" (${req.hosts} hosts).` }
    }
    const info = subnetInfo(intToIp(cursor), req.prefix)
    allocations.push({ ...info, name: req.name, requestedHosts: req.hosts, wastedAddresses: info.usableHosts - req.hosts })
    cursor += size
  }

  const used = cursor - baseStart
  return { ok: true, allocations, usedAddresses: used, freeAddresses: baseEnd - cursor }
}
