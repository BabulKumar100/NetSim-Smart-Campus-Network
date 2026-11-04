import { describe, expect, it } from 'vitest'
import { calculateVlsm, isValidIp, maskToPrefix, subnetInfo, isUsableHost } from '../lib/network/ip'
import { testConnectivity } from '../lib/network/engine'
import { createInitialState, validateNetwork } from '../lib/network/state'
import { dnsLookup, requestDhcp } from '../lib/network/services'
import { SCENARIOS, checkScenario } from '../lib/network/scenarios'
import { generateConfigs } from '../lib/network/ios'
import { getDevice } from '../lib/network/l2'

const fresh = () => createInitialState()
const ping = (s, a, b) => testConnectivity(s, { sourceId: a, destination: { deviceId: b } })

describe('IPv4 addressing', () => {
  it('TC-01 accepts valid and rejects invalid IPv4 addresses', () => {
    expect(isValidIp('10.10.10.1')).toBe(true)
    expect(isValidIp('255.255.255.255')).toBe(true)
    expect(isValidIp('256.1.1.1')).toBe(false)
    expect(isValidIp('10.10.10')).toBe(false)
    expect(isValidIp('10.10.010.1')).toBe(false)
    expect(isValidIp('abc')).toBe(false)
  })

  it('TC-02 calculates /24 subnet details', () => {
    const s = subnetInfo('10.10.30.77', 24)
    expect(s).toMatchObject({
      network: '10.10.30.0',
      mask: '255.255.255.0',
      firstUsable: '10.10.30.1',
      lastUsable: '10.10.30.254',
      broadcast: '10.10.30.255',
      usableHosts: 254,
    })
  })

  it('TC-03 calculates non-octet subnets and validates masks', () => {
    expect(subnetInfo('192.168.1.130', 26)).toMatchObject({ network: '192.168.1.128', broadcast: '192.168.1.191', usableHosts: 62 })
    expect(subnetInfo('203.0.113.1', 30)).toMatchObject({
      network: '203.0.113.0',
      firstUsable: '203.0.113.1',
      lastUsable: '203.0.113.2',
      usableHosts: 2,
    })
    expect(maskToPrefix('255.255.255.192')).toBe(26)
    expect(maskToPrefix('255.0.255.0')).toBeNull()
    expect(maskToPrefix('255.255.255.256')).toBeNull()
  })

  it('TC-04 rejects network and broadcast addresses as host addresses', () => {
    expect(isUsableHost('10.10.10.0', 24)).toBe(false)
    expect(isUsableHost('10.10.10.255', 24)).toBe(false)
    expect(isUsableHost('10.10.10.25', 24)).toBe(true)
  })

  it('TC-05 allocates non-overlapping VLSM subnets largest first', () => {
    const r = calculateVlsm('10.10.0.0', 22, [
      { name: 'Library', hosts: 50 },
      { name: 'CSE', hosts: 200 },
      { name: 'Admin', hosts: 25 },
    ])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.allocations.map((a) => `${a.name} ${a.network}/${a.prefix}`)).toEqual([
      'CSE 10.10.0.0/24',
      'Library 10.10.1.0/26',
      'Admin 10.10.1.64/27',
    ])
    expect(calculateVlsm('10.10.0.0', 24, [{ name: 'Big', hosts: 300 }]).ok).toBe(false)
  })
})

describe('Campus configuration validation', () => {
  it('TC-06 default campus plan has no validation errors', () => {
    const errors = validateNetwork(fresh()).filter((i) => i.severity === 'error')
    expect(errors).toEqual([])
  })

  it('TC-07 detects duplicate IP addresses', () => {
    const s = fresh()
    getDevice(s, 'ADM-PC2').host.ip = getDevice(s, 'ADM-PC1').host.ip
    expect(validateNetwork(s).some((i) => i.message.startsWith('Duplicate IP'))).toBe(true)
  })

  it('TC-08 detects a gateway that does not match the plan', () => {
    const s = fresh()
    getDevice(s, 'CSE-PC1').host.gateway = '10.10.20.1'
    expect(validateNetwork(s).some((i) => i.category === 'gateway' && i.subject === 'CSE-PC1')).toBe(true)
  })

  it('TC-09 detects a host port in the wrong VLAN', () => {
    const s = fresh()
    s.links.find((l) => l.id === 'L-CSE-PC1').vlan = 20
    expect(validateNetwork(s).some((i) => i.category === 'vlan' && i.subject === 'CSE-PC1')).toBe(true)
  })
})

describe('DHCP and DNS', () => {
  it('TC-10 DHCP leases addresses outside the excluded range with matching options', () => {
    const s = fresh()
    const pc = getDevice(s, 'CSE-PC1').host
    expect(pc).toMatchObject({ ip: '10.10.10.11', prefix: 24, gateway: '10.10.10.1', dns: '10.10.40.10' })
    expect(getDevice(s, 'LAPTOP-1').host.ip).toBe('10.10.50.11')
    const leasedIps = s.dhcp.leases.map((l) => l.ip)
    expect(new Set(leasedIps).size).toBe(leasedIps.length)
  })

  it('TC-11 DHCP fails to APIPA when the service is disabled', () => {
    const s = fresh()
    s.dhcp.enabled = false
    const r = requestDhcp(s, 'CSE-PC3')
    expect(r.ok).toBe(false)
    expect(getDevice(r.state, 'CSE-PC3').host.ip.startsWith('169.254.')).toBe(true)
  })

  it('TC-12 DNS resolves configured records and reports NXDOMAIN for unknown names', () => {
    const s = fresh()
    expect(dnsLookup(s, 'CSE-PC1', 'portal.campus.local')).toMatchObject({ status: 'resolved', address: '10.10.40.10' })
    expect(dnsLookup(s, 'LAPTOP-1', 'library.campus.local')).toMatchObject({ status: 'resolved', address: '10.10.40.20' })
    expect(dnsLookup(s, 'CSE-PC1', 'exam.campus.local').status).toBe('nxdomain')
  })
})

describe('Connectivity and routing', () => {
  it('TC-13 same-subnet ping succeeds without a router hop', () => {
    const r = ping(fresh(), 'CSE-PC1', 'CSE-PC2')
    expect(r.success).toBe(true)
    expect(r.forward.routerHops).toBe(0)
  })

  it('TC-14 inter-VLAN ping succeeds through R1', () => {
    const r = ping(fresh(), 'CSE-PC1', 'LIB-PC1')
    expect(r.success).toBe(true)
    expect(r.gatewayUsed).toBe('10.10.10.1')
    expect(r.forward.routerHops).toBe(1)
    expect(r.replyTtl).toBe(127)
  })

  it('TC-15 PC to server and Wi-Fi to server succeed', () => {
    const s = fresh()
    expect(ping(s, 'ADM-PC1', 'SRV-CORE').success).toBe(true)
    expect(ping(s, 'PHONE-1', 'SRV-LIB').success).toBe(true)
  })

  it('TC-16 Internet-bound traffic uses the default route and NAT', () => {
    const s = fresh()
    const r = ping(s, 'CSE-PC1', 'PUBLIC-WEB')
    expect(r.success).toBe(true)
    expect(r.forward.steps.some((st) => st.title.startsWith('NAT overload'))).toBe(true)
    getDevice(s, 'R1').natOverload = false
    const noNat = ping(s, 'CSE-PC1', 'PUBLIC-WEB')
    expect(noNat.success).toBe(false)
    expect(noNat.reply?.reason).toMatch(/no connected or static route/)
  })

  it('TC-17 ACL blocks Wi-Fi to Administration but permits Wi-Fi to servers', () => {
    const s = fresh()
    const blocked = ping(s, 'LAPTOP-1', 'ADM-PC1')
    expect(blocked.success).toBe(false)
    expect(blocked.forward.reason).toMatch(/WIFI-IN/)
    expect(ping(s, 'LAPTOP-1', 'SRV-CORE').success).toBe(true)
  })

  it('TC-18 fails for unknown destination IP and offline destination', () => {
    const s = fresh()
    expect(testConnectivity(s, { sourceId: 'CSE-PC1', destination: { ip: '10.10.30.200' } }).success).toBe(false)
    getDevice(s, 'SRV-LIB').online = false
    expect(ping(s, 'CSE-PC1', 'SRV-LIB').success).toBe(false)
  })
})

describe('Troubleshooting lab', () => {
  for (const sc of SCENARIOS) {
    it(`TC-19 scenario "${sc.title}" fails when injected`, () => {
      const broken = sc.inject(fresh())
      expect(checkScenario(sc, broken).testPassed).toBe(false)
    })
  }

  it('TC-20 corrected configurations are recognised as solved', () => {
    const fixes = {
      gateway: (s) => {
        getDevice(s, 'CSE-PC2').host.gateway = '10.10.10.1'
      },
      mask: (s) => {
        getDevice(s, 'ADM-PC1').host.prefix = 24
      },
      duplicate: (s) => {
        getDevice(s, 'LIB-PC2').host.mode = 'dhcp'
        Object.assign(s, requestDhcp(s, 'LIB-PC2').state)
      },
      'dhcp-down': (s) => {
        s.dhcp.enabled = true
      },
      'dns-missing': (s) => {
        s.dns.records.push({ id: 'x', name: 'library.campus.local', type: 'A', value: '10.10.40.20' })
      },
      'iface-down': (s) => {
        getDevice(s, 'R1').interfaces.find((f) => f.name === 'G0/0.30').up = true
      },
      'missing-route': (s) => {
        getDevice(s, 'R1').routes = [{ id: 'd', network: '0.0.0.0', prefix: 0, nextHop: '203.0.113.2' }]
      },
      'wrong-vlan': (s) => {
        s.links.find((l) => l.id === 'L-LIB-PC1').vlan = 30
      },
      trunk: (s) => {
        s.links.find((l) => l.id === 'L-CORE-ADM').allowedVlans = [20]
      },
    }
    for (const sc of SCENARIOS) {
      const s = sc.inject(fresh())
      fixes[sc.id](s)
      const result = checkScenario(sc, s)
      expect({ id: sc.id, solved: result.solved, issues: result.issues }).toEqual({ id: sc.id, solved: true, issues: [] })
    }
  })

  it('TC-21 a passing ping alone does not mark a scenario solved when the plan is violated', () => {
    const sc = SCENARIOS.find((x) => x.id === 'gateway')
    const s = sc.inject(fresh())
    const pc = getDevice(s, 'CSE-PC2').host
    pc.gateway = '10.10.10.1'
    getDevice(s, 'CSE-PC3').host.gateway = '10.10.10.99'
    const r = checkScenario(sc, s)
    expect(r.testPassed).toBe(true)
    expect(r.solved).toBe(false)
  })
})

describe('Generated Cisco IOS configuration', () => {
  it('TC-22 router and switch configs match the VLAN and subnet plan', () => {
    const configs = generateConfigs(fresh())
    const r1 = configs.find((c) => c.deviceId === 'R1').config
    expect(r1).toContain(
      'interface GigabitEthernet0/0.20\n description Gateway for Administration (VLAN 20)\n encapsulation dot1Q 20\n ip address 10.10.20.1 255.255.255.0',
    )
    expect(r1).toContain('ip route 0.0.0.0 0.0.0.0 203.0.113.2')
    expect(r1).toContain(' deny ip 10.10.50.0 0.0.0.255 10.10.20.0 0.0.0.255')
    const lib = configs.find((c) => c.deviceId === 'LIB-SW').config
    expect(lib).toContain('interface FastEthernet0/1\n description Link to LIB-PC1\n switchport mode access\n switchport access vlan 30')
    const core = configs.find((c) => c.deviceId === 'CORE-SW').config
    expect(core).toContain('switchport trunk allowed vlan 10,20,30,40,50')
  })
})
