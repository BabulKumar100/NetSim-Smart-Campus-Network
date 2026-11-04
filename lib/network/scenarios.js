import { testConnectivity } from './engine'
import { getDevice } from './l2'
import { dnsLookup, requestDhcp } from './services'
import { validateNetwork } from './state'

function mutate(state, fn) {
  const next = structuredClone(state)
  fn(next)
  return next
}

export const SCENARIOS = [
  {
    id: 'gateway',
    title: 'Incorrect default gateway',
    symptoms: 'CSE-PC2 can ping other CSE computers but cannot open the campus portal on SRV-CORE.',
    hint: 'Same-subnet traffic works, so cabling and the IP address are probably fine. What is used only for remote subnets?',
    diagnostics: [
      { kind: 'ipconfig', device: 'CSE-PC2' },
      { kind: 'show-ip-int-brief', device: 'R1' },
    ],
    procedure: [
      'Run ipconfig on CSE-PC2 and note the default gateway.',
      'Compare it with the IP address of R1 G0/0.10 (show ip interface brief).',
      'Ping the gateway address from CSE-PC2.',
    ],
    cause: 'The PC was configured statically with gateway 10.10.10.254, an address no router owns. ARP for the gateway receives no reply.',
    correction: 'Set the default gateway to 10.10.10.1 (or switch the PC back to DHCP and renew), then repeat the test.',
    focus: [{ kind: 'host', id: 'CSE-PC2' }],
    test: { kind: 'ping', source: 'CSE-PC2', destination: { deviceId: 'SRV-CORE' } },
    inject: (s) =>
      mutate(s, (n) => {
        const d = getDevice(n, 'CSE-PC2')
        d.host = { ...d.host, mode: 'static', gateway: '10.10.10.254' }
        n.dhcp.leases = n.dhcp.leases.filter((l) => l.deviceId !== 'CSE-PC2')
      }),
    fix: (s) =>
      mutate(s, (n) => {
        getDevice(n, 'CSE-PC2').host.gateway = '10.10.10.1'
      }),
  },
  {
    id: 'mask',
    title: 'Wrong subnet mask',
    symptoms: 'ADM-PC1 cannot reach the library catalogue server SRV-LIB, although the gateway address looks correct.',
    hint: 'With a larger mask, the PC may believe a remote address is on its own network.',
    diagnostics: [{ kind: 'ipconfig', device: 'ADM-PC1' }],
    procedure: [
      'Run ipconfig on ADM-PC1 and inspect the subnet mask.',
      'AND the PC address and SRV-LIB address with that mask – do they look local?',
      'Compare with the planned /24 mask for VLAN 20.',
    ],
    cause:
      'The mask is 255.255.0.0 (/16). 10.10.40.20 therefore appears to be in the same network, so the PC ARPs for it directly inside VLAN 20 instead of using the gateway.',
    correction: 'Change the mask to 255.255.255.0 (/24).',
    focus: [{ kind: 'host', id: 'ADM-PC1' }],
    test: { kind: 'ping', source: 'ADM-PC1', destination: { deviceId: 'SRV-LIB' } },
    inject: (s) =>
      mutate(s, (n) => {
        const d = getDevice(n, 'ADM-PC1')
        d.host = { ...d.host, mode: 'static', prefix: 16 }
        n.dhcp.leases = n.dhcp.leases.filter((l) => l.deviceId !== 'ADM-PC1')
      }),
    fix: (s) =>
      mutate(s, (n) => {
        getDevice(n, 'ADM-PC1').host.prefix = 24
      }),
  },
  {
    id: 'duplicate',
    title: 'Duplicate IP address',
    symptoms: 'Connections to LIB-PC1 from other departments fail and the library reports "IP address conflict" messages.',
    hint: 'Look at every address in the Library VLAN.',
    diagnostics: [
      { kind: 'ipconfig', device: 'LIB-PC1' },
      { kind: 'ipconfig', device: 'LIB-PC2' },
    ],
    procedure: [
      'Run ipconfig on both library PCs.',
      'Look for two devices with the same IPv4 address.',
      'Check the DHCP exclusion range before choosing a static address.',
    ],
    cause:
      "LIB-PC2 was given LIB-PC1's address statically. Two hosts answer the ARP request, so the router cannot deliver traffic reliably.",
    correction: 'Give LIB-PC2 a unique address (for example switch it back to DHCP and renew).',
    focus: [
      { kind: 'host', id: 'LIB-PC2' },
      { kind: 'host', id: 'LIB-PC1' },
    ],
    test: { kind: 'ping', source: 'CSE-PC1', destination: { deviceId: 'LIB-PC1' } },
    inject: (s) =>
      mutate(s, (n) => {
        const pc1 = getDevice(n, 'LIB-PC1')
        const pc2 = getDevice(n, 'LIB-PC2')
        pc2.host = { ...pc1.host, mode: 'static' }
        n.dhcp.leases = n.dhcp.leases.filter((l) => l.deviceId !== 'LIB-PC2')
      }),
    fix: (s) =>
      requestDhcp(
        mutate(s, (n) => {
          getDevice(n, 'LIB-PC2').host.mode = 'dhcp'
        }),
        'LIB-PC2',
      ).state,
  },
  {
    id: 'dhcp-down',
    title: 'DHCP server unavailable',
    symptoms: 'LAPTOP-1 joins the Wi-Fi but shows a 169.254.x.x address and cannot open any campus page.',
    hint: '169.254.0.0/16 is what a client assigns itself when nobody answers its DHCP Discover.',
    diagnostics: [
      { kind: 'ipconfig', device: 'LAPTOP-1' },
      { kind: 'show-dhcp', device: 'R1' },
    ],
    procedure: [
      'Run ipconfig on LAPTOP-1 – an APIPA address means DHCP failed.',
      'Check whether the DHCP service is running on R1.',
      'Enable the service and renew the lease on the client.',
    ],
    cause: 'The DHCP service on R1 was disabled ("no service dhcp"), so the Discover broadcast is never answered.',
    correction: 'Re-enable DHCP on R1, then click "Renew DHCP" on LAPTOP-1 (the test below also renews).',
    focus: [{ kind: 'dhcp' }, { kind: 'host', id: 'LAPTOP-1' }],
    test: { kind: 'dhcp', client: 'LAPTOP-1', thenPing: { deviceId: 'SRV-CORE' } },
    inject: (s) => {
      const disabled = mutate(s, (n) => {
        n.dhcp.enabled = false
      })
      return requestDhcp(disabled, 'LAPTOP-1').state
    },
    fix: (s) =>
      requestDhcp(
        mutate(s, (n) => {
          n.dhcp.enabled = true
        }),
        'LAPTOP-1',
      ).state,
  },
  {
    id: 'dns-missing',
    title: 'DNS record missing',
    symptoms: 'Students can open portal.campus.local, but library.campus.local returns "server not found". Pinging 10.10.40.20 works.',
    hint: 'If the IP works but the name does not, the problem is name resolution, not routing.',
    diagnostics: [{ kind: 'dns-records' }],
    procedure: [
      'Ping 10.10.40.20 to prove routing works.',
      'Look up library.campus.local and note the NXDOMAIN answer.',
      'Inspect the A records on SRV-CORE.',
    ],
    cause: 'The A record for library.campus.local was deleted from the DNS server.',
    correction: 'Add an A record: library.campus.local → 10.10.40.20.',
    focus: [{ kind: 'dns' }],
    test: { kind: 'dns', client: 'LIB-PC1', name: 'library.campus.local' },
    inject: (s) =>
      mutate(s, (n) => {
        n.dns.records = n.dns.records.filter((r) => r.name !== 'library.campus.local')
      }),
    fix: (s) =>
      mutate(s, (n) => {
        n.dns.records.push({ id: 'rr-library-restore', name: 'library.campus.local', type: 'A', value: '10.10.40.20' })
      }),
  },
  {
    id: 'iface-down',
    title: 'Interface disabled',
    symptoms: 'The whole Library cannot reach any other department, and pinging 10.10.30.1 fails from every library PC.',
    hint: 'When every host in one subnet loses its gateway at once, look at the gateway itself.',
    diagnostics: [
      { kind: 'show-ip-int-brief', device: 'R1' },
      { kind: 'show-ip-route', device: 'R1' },
    ],
    procedure: [
      'Ping the gateway 10.10.30.1 from LIB-PC1.',
      'Run show ip interface brief on R1 – look for "administratively down".',
      'Notice that 10.10.30.0/24 is missing from show ip route.',
    ],
    cause: 'Subinterface G0/0.30 was shut down. A down interface has no connected route and does not answer ARP.',
    correction: 'Bring G0/0.30 up ("no shutdown").',
    focus: [{ kind: 'iface', device: 'R1', name: 'G0/0.30' }],
    test: { kind: 'ping', source: 'LIB-PC1', destination: { deviceId: 'SRV-CORE' } },
    inject: (s) =>
      mutate(s, (n) => {
        getDevice(n, 'R1').interfaces.find((f) => f.name === 'G0/0.30').up = false
      }),
    fix: (s) =>
      mutate(s, (n) => {
        getDevice(n, 'R1').interfaces.find((f) => f.name === 'G0/0.30').up = true
      }),
  },
  {
    id: 'missing-route',
    title: 'Missing route',
    symptoms: 'All internal traffic works, but no department can reach the external web server 198.51.100.10.',
    hint: 'R1 knows its own subnets. How does it learn about networks beyond the ISP?',
    diagnostics: [{ kind: 'show-ip-route', device: 'R1' }],
    procedure: [
      'Ping 203.0.113.2 (ISP) – it works because it is directly connected.',
      'Ping 198.51.100.10 – it fails.',
      'Run show ip route on R1 and look for "Gateway of last resort".',
    ],
    cause: 'The default static route towards the ISP was removed, so R1 has no route for 198.51.100.0/24.',
    correction: 'Add the default route 0.0.0.0/0 via 203.0.113.2.',
    focus: [{ kind: 'routes', device: 'R1' }],
    test: { kind: 'ping', source: 'CSE-PC1', destination: { deviceId: 'PUBLIC-WEB' } },
    inject: (s) =>
      mutate(s, (n) => {
        getDevice(n, 'R1').routes = []
      }),
    fix: (s) =>
      mutate(s, (n) => {
        getDevice(n, 'R1').routes = [{ id: 'default', network: '0.0.0.0', prefix: 0, nextHop: '203.0.113.2' }]
      }),
  },
  {
    id: 'wrong-vlan',
    title: 'Incorrect VLAN assignment',
    symptoms:
      'LIB-PC1 was moved to a new desk. It now shows no valid connectivity although the cable is plugged in and the link light is on.',
    hint: 'A physical link can be up while the port belongs to the wrong broadcast domain.',
    diagnostics: [
      { kind: 'show-vlan-brief', device: 'LIB-SW' },
      { kind: 'ipconfig', device: 'LIB-PC1' },
    ],
    procedure: ['Run show vlan brief on LIB-SW and find Fa0/1.', 'Compare the port VLAN with the Library VLAN (30).'],
    cause:
      'LIB-SW Fa0/1 was placed in VLAN 10. That VLAN is not carried on the Library trunk, so frames never reach the router subinterface.',
    correction: 'Set LIB-SW Fa0/1 to "switchport access vlan 30".',
    focus: [{ kind: 'link', id: 'L-LIB-PC1' }],
    test: { kind: 'ping', source: 'LIB-PC1', destination: { deviceId: 'SRV-CORE' } },
    inject: (s) =>
      mutate(s, (n) => {
        n.links.find((l) => l.id === 'L-LIB-PC1').vlan = 10
      }),
    fix: (s) =>
      mutate(s, (n) => {
        n.links.find((l) => l.id === 'L-LIB-PC1').vlan = 30
      }),
  },
  {
    id: 'trunk',
    title: 'Trunk misconfiguration',
    symptoms: 'Every Administration computer lost access to other departments at the same time.',
    hint: 'All devices on one access switch failing together points to the uplink.',
    diagnostics: [
      { kind: 'show-interfaces-trunk', device: 'CORE-SW' },
      { kind: 'show-vlan-brief', device: 'ADM-SW' },
    ],
    procedure: ['Run show interfaces trunk on CORE-SW.', 'Check the allowed-VLAN list on Fa0/2 (towards ADM-SW).'],
    cause: 'The trunk from CORE-SW Fa0/2 to ADM-SW only allows VLAN 10, so VLAN 20 frames are dropped.',
    correction: 'Allow VLAN 20 on the trunk ("switchport trunk allowed vlan 20").',
    focus: [{ kind: 'link', id: 'L-CORE-ADM' }],
    test: { kind: 'ping', source: 'ADM-PC2', destination: { deviceId: 'SRV-CORE' } },
    inject: (s) =>
      mutate(s, (n) => {
        n.links.find((l) => l.id === 'L-CORE-ADM').allowedVlans = [10]
      }),
    fix: (s) =>
      mutate(s, (n) => {
        n.links.find((l) => l.id === 'L-CORE-ADM').allowedVlans = [20]
      }),
  },
]

/** Re-runs the scenario test against the edited configuration and validates it against the plan. */
export function checkScenario(scenario, input) {
  let state = input
  let ping
  let dns
  let dhcp
  let testPassed = false

  const t = scenario.test
  if (t.kind === 'ping') {
    ping = testConnectivity(state, { sourceId: t.source, destination: t.destination, protocol: t.protocol, dstPort: t.port })
    testPassed = ping.success
  } else if (t.kind === 'dns') {
    dns = dnsLookup(state, t.client, t.name)
    const owner = state.devices.find((d) => d.host?.ip === dns.address)
    testPassed = dns.status === 'resolved' && owner?.id === 'SRV-LIB'
  } else {
    const dev = getDevice(state, t.client)
    if (dev?.host?.mode === 'dhcp') {
      dhcp = requestDhcp(state, t.client)
      state = dhcp.state
    }
    ping = testConnectivity(state, { sourceId: t.client, destination: t.thenPing })
    testPassed = Boolean(dhcp?.ok) && ping.success
  }

  const issues = validateNetwork(state).filter((i) => i.severity === 'error')
  const solved = testPassed && issues.length === 0
  const message = solved
    ? 'Test passed and the configuration now matches the addressing and VLAN plan.'
    : testPassed
      ? `The test passes, but ${issues.length} configuration error(s) remain against the plan.`
      : 'The test still fails. Inspect the configuration again.'
  return { solved, testPassed, issues, state, ping, dns, dhcp, message }
}
