import { routingTable } from './engine'
import { prefixToMask } from './ip'
import { getDevice, linksOf } from './l2'
const pad = (s, n) => (s.length >= n ? `${s} ` : s + ' '.repeat(n - s.length))

export function commandLabel(cmd) {
  switch (cmd.kind) {
    case 'ipconfig':
      return `${cmd.device}> ipconfig /all`
    case 'show-ip-int-brief':
      return `${cmd.device}# show ip interface brief`
    case 'show-ip-route':
      return `${cmd.device}# show ip route`
    case 'show-vlan-brief':
      return `${cmd.device}# show vlan brief`
    case 'show-interfaces-trunk':
      return `${cmd.device}# show interfaces trunk`
    case 'show-dhcp':
      return `${cmd.device}# show ip dhcp binding`
    case 'dns-records':
      return 'SRV-CORE › Services › DNS (record table)'
  }
}

/** Produces simulated command output from the model. The layout imitates IOS/Windows but is not captured from a real device. */
export function runDiagnostic(state, cmd) {
  switch (cmd.kind) {
    case 'ipconfig': {
      const d = getDevice(state, cmd.device)
      if (!d?.host) return 'Device has no IP stack.'
      const h = d.host
      return [
        `Physical Address......: ${d.mac}`,
        `Configuration mode....: ${h.mode === 'dhcp' ? 'DHCP' : 'Static'}`,
        `IPv4 Address..........: ${h.ip || '0.0.0.0'}`,
        `Subnet Mask...........: ${h.prefix ? prefixToMask(h.prefix) : '0.0.0.0'}`,
        `Default Gateway.......: ${h.gateway || '0.0.0.0'}`,
        `DNS Servers...........: ${h.dns || '0.0.0.0'}`,
        `Status................: ${d.online ? 'Up' : 'Powered off'}`,
      ].join('\n')
    }
    case 'show-ip-int-brief': {
      const d = getDevice(state, cmd.device)
      const lines = [pad('Interface', 22) + pad('IP-Address', 16) + pad('OK?', 5) + pad('Method', 8) + pad('Status', 23) + 'Protocol']
      const ports = new Set()
      for (const f of d?.interfaces ?? []) ports.add(f.port)
      for (const port of ports) {
        const link = linksOf(state, d.id).find((l) => (l.a.device === d.id ? l.a.port : l.b.port) === port)
        const plain = d.interfaces.find((f) => f.port === port && f.vlan === undefined)
        const physUp = link?.up ?? false
        if (!plain)
          lines.push(
            pad(`GigabitEthernet${port.slice(1)}`, 22) +
              pad('unassigned', 16) +
              pad('YES', 5) +
              pad('unset', 8) +
              pad(physUp ? 'up' : 'down', 23) +
              (physUp ? 'up' : 'down'),
          )
        for (const f of d.interfaces.filter((x) => x.port === port)) {
          const status = !f.up ? 'administratively down' : physUp ? 'up' : 'down'
          lines.push(
            pad(`GigabitEthernet${f.name.slice(1)}`, 22) +
              pad(f.ip, 16) +
              pad('YES', 5) +
              pad('manual', 8) +
              pad(status, 23) +
              (f.up && physUp ? 'up' : 'down'),
          )
        }
      }
      return lines.join('\n')
    }
    case 'show-ip-route': {
      const d = getDevice(state, cmd.device)
      if (!d) return ''
      const table = routingTable(d)
      const def = table.find((r) => r.type === 'static' && r.prefix === 0)
      const lines = [
        'Codes: C - connected, L - local, S - static, * - candidate default',
        '',
        def ? `Gateway of last resort is ${def.nextHop} to network 0.0.0.0` : 'Gateway of last resort is not set',
        '',
      ]
      for (const r of [...table].sort((a, b) => a.network.localeCompare(b.network, undefined, { numeric: true }))) {
        if (r.type === 'connected') {
          lines.push(`C    ${r.network}/${r.prefix} is directly connected, GigabitEthernet${r.iface.name.slice(1)}`)
          lines.push(`L    ${r.iface.ip}/32 is directly connected, GigabitEthernet${r.iface.name.slice(1)}`)
        } else {
          lines.push(`S${r.prefix === 0 ? '*' : ' '}   ${r.network}/${r.prefix} [1/0] via ${r.nextHop}`)
        }
      }
      return lines.join('\n')
    }
    case 'show-vlan-brief': {
      const links = linksOf(state, cmd.device)
      const byVlan = new Map()
      for (const l of links) {
        if (l.mode !== 'access' || l.vlan === undefined) continue
        const port = l.a.device === cmd.device ? l.a.port : l.b.port
        byVlan.set(l.vlan, [...(byVlan.get(l.vlan) ?? []), port])
      }
      const lines = [
        pad('VLAN', 5) + pad('Name', 20) + pad('Status', 10) + 'Ports',
        '---- ------------------- --------- ------------------------',
      ]
      lines.push(pad('1', 5) + pad('default', 20) + pad('active', 10) + '(unused ports)')
      for (const [vlan, ports] of [...byVlan].sort((a, b) => a[0] - b[0])) {
        const seg = state.segments.find((s) => s.vlan === vlan)
        lines.push(pad(String(vlan), 5) + pad(seg?.short ?? `VLAN${vlan}`, 20) + pad('active', 10) + ports.join(', '))
      }
      return lines.join('\n')
    }
    case 'show-interfaces-trunk': {
      const lines = [pad('Port', 10) + pad('Mode', 8) + pad('Encapsulation', 15) + pad('Status', 12) + 'Vlans allowed on trunk']
      for (const l of linksOf(state, cmd.device).filter((x) => x.mode === 'trunk')) {
        const port = l.a.device === cmd.device ? l.a.port : l.b.port
        lines.push(
          pad(port, 10) +
            pad('on', 8) +
            pad('802.1q', 15) +
            pad(l.up ? 'trunking' : 'down', 12) +
            ((l.allowedVlans ?? []).join(',') || 'none'),
        )
      }
      return lines.join('\n')
    }
    case 'show-dhcp': {
      const lines = [
        `DHCP service: ${state.dhcp.enabled ? 'enabled' : 'DISABLED (no service dhcp)'}`,
        '',
        pad('IP address', 17) + pad('Hardware address', 18) + 'Client',
      ]
      for (const lease of state.dhcp.leases)
        lines.push(pad(lease.ip, 17) + pad(lease.mac, 18) + (getDevice(state, lease.deviceId)?.name ?? lease.deviceId))
      if (state.dhcp.leases.length === 0) lines.push('(no bindings)')
      return lines.join('\n')
    }
    case 'dns-records': {
      const lines = [pad('Name', 26) + pad('Type', 6) + 'Address', `DNS service: ${state.dns.enabled ? 'On' : 'Off'}`]
      for (const r of state.dns.records) lines.push(pad(r.name, 26) + pad(r.type, 6) + r.value)
      if (state.dns.records.length === 0) lines.push('(no records)')
      return lines.join('\n')
    }
  }
}
