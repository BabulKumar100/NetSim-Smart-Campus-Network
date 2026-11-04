/** Device coordinates along a traced path, skipping ids that are not on the canvas. */
export function tracePoints(devices, path) {
  const byId = new Map(devices.map((d) => [d.id, d]))
  const points = []
  for (const id of path) {
    const d = byId.get(id)
    if (d) points.push({ id, x: d.x, y: d.y })
  }
  return points
}

/** SVG path data (`M … L …`) for a polyline through the given points. */
export function polylinePath(points) {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
}

/** Cumulative 0–1 progress at each point, proportional to segment length. */
export function polylineKeyPoints(points) {
  if (points.length < 2) return points.map(() => 0)
  const lengths = [0]
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y))
  }
  const total = lengths[lengths.length - 1] || 1
  return lengths.map((l) => Number((l / total).toFixed(4)))
}

/** VLAN label for a device, derived from the segment that owns its zone. */
export function deviceVlanLabel(state, device) {
  const seg = state.segments.find((s) => s.id === device.zone)
  if (seg) return `VLAN ${seg.vlan} · ${seg.short}`
  if (device.zone === 'core') return 'Trunk (all VLANs)'
  if (device.zone === 'external') return 'Outside NAT'
  return '—'
}

/** Windows-style `nslookup` transcript describing a simulated DNS lookup result. */
export function nslookupTranscript(result, server) {
  const lines = [`C:\\> nslookup ${result.name}`]
  if (result.status === 'invalid-name') return [...lines, `*** Invalid host name: ${result.name}`].join('\n')
  if (result.status === 'no-dns-configured')
    return [...lines, '*** Default servers are not available', `*** Can't find ${result.name}: No DNS server configured`].join('\n')
  const serverName = server?.name ?? 'Unknown'
  const serverIp = result.dnsServer ?? server?.ip ?? 'unknown'
  if (result.status === 'server-unreachable' || result.status === 'service-disabled' || result.status === 'server-not-dns') {
    return [
      ...lines,
      `DNS request timed out.`,
      `    timeout was 2 seconds.`,
      `Server:  ${serverName}`,
      `Address:  ${serverIp}`,
      '',
      `*** Request to ${serverName} timed-out`,
    ].join('\n')
  }
  lines.push(`Server:  ${serverName}`, `Address:  ${serverIp}`, '')
  if (result.status === 'nxdomain') return [...lines, `*** ${serverName} can't find ${result.name}: Non-existent domain`].join('\n')
  return [...lines, `Name:    ${result.name}`, `Address:  ${result.address ?? ''}`].join('\n')
}
