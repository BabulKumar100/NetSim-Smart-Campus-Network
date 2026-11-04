import { prefixToMask, prefixToWildcard } from './ip'
import { getDevice, linksOf } from './l2'

const expandPort = (port) => port.replace(/^Fa/, 'FastEthernet').replace(/^G(?=\d)/, 'GigabitEthernet')

function aclAddress(ip, prefix) {
  if (prefix === 0) return 'any'
  if (prefix === 32) return `host ${ip}`
  return `${ip} ${prefixToWildcard(prefix)}`
}

function aclLine(rule) {
  const port = rule.port !== undefined && (rule.protocol === 'tcp' || rule.protocol === 'udp') ? ` eq ${rule.port}` : ''
  return ` ${rule.action} ${rule.protocol} ${aclAddress(rule.src, rule.srcPrefix)} ${aclAddress(rule.dst, rule.dstPrefix)}${port}`
}

function routerConfig(state, router) {
  const out = []
  const isDhcpServer = state.dhcp.serverDeviceId === router.id
  out.push(`! ${router.name} – ${router.model}`, 'enable', 'configure terminal', `hostname ${router.id}`, 'no ip domain-lookup')
  if (router.id === 'R1') {
    out.push(`ip domain-name ${state.dns.domain}`, 'enable secret <choose-a-strong-password>', 'service password-encryption')
  }

  if (isDhcpServer) {
    out.push('!', '! ---- DHCP ----')
    if (!state.dhcp.enabled) out.push('no service dhcp')
    for (const pool of state.dhcp.pools) out.push(`ip dhcp excluded-address ${pool.excludedStart} ${pool.excludedEnd}`)
    for (const pool of state.dhcp.pools) {
      out.push(
        `ip dhcp pool ${pool.name}`,
        ` network ${pool.network} ${prefixToMask(pool.prefix)}`,
        ` default-router ${pool.defaultRouter}`,
        ` dns-server ${pool.dnsServer}`,
      )
    }
  }

  out.push('!', '! ---- Interfaces ----')
  const ifaces = router.interfaces ?? []
  const physicalPorts = [...new Set(ifaces.map((f) => f.port))]
  for (const port of physicalPorts) {
    const subs = ifaces.filter((f) => f.port === port && f.vlan !== undefined)
    const plain = ifaces.find((f) => f.port === port && f.vlan === undefined)
    const link = linksOf(state, router.id).find((l) => (l.a.device === router.id ? l.a.port : l.b.port) === port)
    const peer = link ? getDevice(state, link.a.device === router.id ? link.b.device : link.a.device) : undefined
    out.push(`interface ${expandPort(port)}`)
    if (peer) out.push(` description Link to ${peer.name}`)
    if (plain) {
      out.push(` ip address ${plain.ip} ${prefixToMask(plain.prefix)}`)
      if (plain.nat && router.natOverload) out.push(` ip nat ${plain.nat}`)
      if (plain.aclIn) out.push(` ip access-group ${plain.aclIn} in`)
      out.push(plain.up ? ' no shutdown' : ' shutdown')
    } else {
      out.push(' no ip address', link?.up === false ? ' shutdown' : ' no shutdown')
    }
    for (const sub of subs) {
      out.push(`interface ${expandPort(sub.name)}`)
      if (sub.description) out.push(` description ${sub.description}`)
      out.push(` encapsulation dot1Q ${sub.vlan}`, ` ip address ${sub.ip} ${prefixToMask(sub.prefix)}`)
      if (sub.nat && router.natOverload) out.push(` ip nat ${sub.nat}`)
      if (sub.aclIn) out.push(` ip access-group ${sub.aclIn} in`)
      out.push(sub.up ? ' no shutdown' : ' shutdown')
    }
  }

  const usedAcls = new Set(ifaces.map((f) => f.aclIn).filter(Boolean))
  for (const acl of state.acls.filter((a) => usedAcls.has(a.name))) {
    out.push('!', `! ---- Access list ${acl.name} ----`, `ip access-list extended ${acl.name}`)
    for (const rule of [...acl.rules].sort((a, b) => a.seq - b.seq)) {
      if (rule.remark) out.push(` remark ${rule.remark}`)
      out.push(aclLine(rule))
    }
  }

  if (router.natOverload) {
    const outside = ifaces.find((f) => f.nat === 'outside')
    if (outside) {
      out.push(
        '!',
        '! ---- NAT overload (PAT) ----',
        'access-list 1 permit 10.10.0.0 0.0.255.255',
        `ip nat inside source list 1 interface ${expandPort(outside.name)} overload`,
      )
    }
  }

  if ((router.routes ?? []).length > 0) {
    out.push('!', '! ---- Static routes ----')
    for (const r of router.routes ?? []) out.push(`ip route ${r.network} ${prefixToMask(r.prefix)} ${r.nextHop}`)
  }

  if (router.id === 'R1') {
    out.push(
      '!',
      '! ---- Secure management (SSH v2) ----',
      'username netadmin secret <choose-a-strong-password>',
      'crypto key generate rsa',
      '! (enter 1024 or 2048 when prompted for the modulus size)',
      'ip ssh version 2',
      'line vty 0 4',
      ' login local',
      ' transport input ssh',
      'line console 0',
      ' login local',
    )
  }
  out.push('end', 'copy running-config startup-config')
  return out.join('\n')
}

function switchConfig(state, sw) {
  const out = [`! ${sw.name} – ${sw.model}`, 'enable', 'configure terminal', `hostname ${sw.id}`, 'no ip domain-lookup']
  const links = linksOf(state, sw.id)
  const vlans = new Set()
  for (const l of links) {
    if (l.mode === 'access' && l.vlan !== undefined) vlans.add(l.vlan)
    if (l.mode === 'trunk') (l.allowedVlans ?? []).forEach((v) => vlans.add(v))
  }
  out.push('!', '! ---- VLAN database ----')
  for (const v of [...vlans].sort((a, b) => a - b)) {
    const seg = state.segments.find((s) => s.vlan === v)
    out.push(`vlan ${v}`, ` name ${seg?.short ?? `VLAN${v}`}`)
  }
  out.push('!', '! ---- Ports ----')
  const sorted = [...links].sort((a, b) => {
    const pa = a.a.device === sw.id ? a.a.port : a.b.port
    const pb = b.a.device === sw.id ? b.a.port : b.b.port
    return pa.localeCompare(pb, undefined, { numeric: true })
  })
  for (const l of sorted) {
    const port = l.a.device === sw.id ? l.a.port : l.b.port
    const peer = getDevice(state, l.a.device === sw.id ? l.b.device : l.a.device)
    out.push(`interface ${expandPort(port)}`, ` description Link to ${peer?.name ?? 'unknown'}`)
    if (l.mode === 'trunk') {
      out.push(' switchport mode trunk', ` switchport trunk allowed vlan ${(l.allowedVlans ?? []).join(',') || 'none'}`)
    } else if (l.mode === 'access') {
      out.push(' switchport mode access', ` switchport access vlan ${l.vlan}`, ' spanning-tree portfast')
    }
    out.push(l.up ? ' no shutdown' : ' shutdown')
  }
  out.push('end', 'copy running-config startup-config')
  return out.join('\n')
}

export function generateConfigs(state) {
  const configs = []
  for (const dev of state.devices) {
    if (dev.type === 'router') configs.push({ deviceId: dev.id, title: dev.name, model: dev.model, config: routerConfig(state, dev) })
  }
  for (const dev of state.devices) {
    if (dev.type === 'switch') configs.push({ deviceId: dev.id, title: dev.name, model: dev.model, config: switchConfig(state, dev) })
  }
  return configs
}

export const COMMAND_EXPLANATIONS = [
  {
    command: 'enable / configure terminal',
    meaning: 'Enter privileged EXEC mode, then global configuration mode where settings are changed.',
  },
  { command: 'hostname R1', meaning: 'Names the device; the name appears in the prompt and in CDP neighbour tables.' },
  { command: 'vlan 10 / name CSE', meaning: 'Creates VLAN 10 in the switch VLAN database and gives it a readable name.' },
  {
    command: 'switchport mode access',
    meaning: 'Makes the port carry exactly one VLAN, untagged. Used for PCs, servers and the access point.',
  },
  {
    command: 'switchport access vlan 10',
    meaning: 'Places the access port into VLAN 10, so the attached device joins the CSE broadcast domain.',
  },
  {
    command: 'switchport mode trunk',
    meaning: 'Makes the port carry many VLANs using 802.1Q tags. Used between switches and towards the router.',
  },
  {
    command: 'switchport trunk allowed vlan 10',
    meaning: 'Limits which VLANs may cross the trunk. A VLAN missing from this list cannot reach the router.',
  },
  {
    command: 'spanning-tree portfast',
    meaning: 'Lets an access port start forwarding immediately instead of waiting for STP listening/learning. Only for end-device ports.',
  },
  {
    command: 'interface GigabitEthernet0/0.10',
    meaning: 'Creates a logical subinterface on the physical port – one per VLAN for router-on-a-stick.',
  },
  {
    command: 'encapsulation dot1Q 10',
    meaning: 'Tells the subinterface to accept and send frames tagged with VLAN 10. Must match the switch VLAN.',
  },
  {
    command: 'ip address 10.10.10.1 255.255.255.0',
    meaning: 'Assigns the gateway address for the CSE subnet. Hosts use this as their default gateway.',
  },
  {
    command: 'no shutdown / shutdown',
    meaning: 'Administratively enables or disables an interface. Router interfaces are shut down by default.',
  },
  {
    command: 'ip dhcp excluded-address 10.10.10.1 10.10.10.10',
    meaning: 'Reserves the first ten addresses (gateway, printers, future static devices) so DHCP never leases them.',
  },
  {
    command: 'ip dhcp pool CSE / network / default-router / dns-server',
    meaning: 'Defines the range DHCP leases from and the gateway and DNS server it hands to clients.',
  },
  { command: 'ip nat inside / ip nat outside', meaning: 'Marks which interfaces face the private campus and which face the ISP.' },
  {
    command: 'ip nat inside source list 1 interface G0/1 overload',
    meaning: 'Port Address Translation: all private addresses permitted by ACL 1 share the single public address of G0/1.',
  },
  {
    command: 'ip route 0.0.0.0 0.0.0.0 203.0.113.2',
    meaning: 'Default static route: anything not matched by a more specific route is sent to the ISP.',
  },
  { command: 'ip access-list extended WIFI-IN', meaning: 'Creates a named extended ACL that can match source, destination and protocol.' },
  {
    command: 'ip access-group WIFI-IN in',
    meaning: 'Applies the ACL to packets entering the Wi-Fi subinterface. Every ACL ends with an implicit "deny any".',
  },
  {
    command: 'crypto key generate rsa / ip ssh version 2',
    meaning: 'Creates the RSA key pair needed for SSH and forces the more secure SSH version 2.',
    dependsOnModel: 'Requires an IOS image with the security (k9) feature set; supported by the Packet Tracer 2911.',
  },
  { command: 'transport input ssh', meaning: 'Allows only SSH (not Telnet) on the remote-management VTY lines.' },
  { command: 'copy running-config startup-config', meaning: 'Saves the active configuration to NVRAM so it survives a reboot.' },
]
