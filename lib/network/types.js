/**
 * Data model for the simulated campus network (JSDoc only — no runtime code).
 *
 * @typedef {'router' | 'switch' | 'server' | 'pc' | 'ap' | 'wireless'} DeviceType
 * @typedef {'cse' | 'admin' | 'library' | 'servers' | 'wifi'} SegmentId
 * @typedef {SegmentId | 'core' | 'external'} Zone
 *
 * @typedef {{ id: SegmentId, name: string, short: string, vlan: number, network: string, prefix: number, gateway: string }} Segment
 * @typedef {{ mode: 'dhcp' | 'static', ip: string, prefix: number, gateway: string, dns: string }} HostConfig
 * @typedef {{ name: string, port: string, vlan?: number, ip: string, prefix: number, up: boolean, nat?: 'inside' | 'outside', aclIn?: string, description?: string }} RouterInterface
 * @typedef {{ id: string, network: string, prefix: number, nextHop: string }} StaticRoute
 *
 * @typedef {Object} Device
 * @property {string} id
 * @property {string} name
 * @property {DeviceType} type
 * @property {string} model
 * @property {Zone} zone
 * @property {string} mac
 * @property {boolean} online
 * @property {number} x
 * @property {number} y
 * @property {string} description
 * @property {HostConfig} [host]
 * @property {RouterInterface[]} [interfaces]
 * @property {StaticRoute[]} [routes]
 * @property {boolean} [natOverload]
 * @property {string[]} [services]
 * @property {string} [ssid]
 *
 * @typedef {{ device: string, port: string }} LinkEnd
 *
 * access   – one end is a switch port in access mode (untagged, single VLAN)
 * trunk    – 802.1Q tagged link carrying `allowedVlans`
 * direct   – untagged point-to-point link with no switch (router-router, router-host)
 * wireless – 802.11 association between an access point and a client
 * @typedef {'access' | 'trunk' | 'direct' | 'wireless'} LinkMode
 *
 * @typedef {{ id: string, a: LinkEnd, b: LinkEnd, mode: LinkMode, vlan?: number, allowedVlans?: number[], up: boolean, medium: 'copper-straight' | 'copper-cross' | 'serial' | 'wireless' }} Link
 * @typedef {{ id: string, name: string, network: string, prefix: number, defaultRouter: string, dnsServer: string, excludedStart: string, excludedEnd: string }} DhcpPool
 * @typedef {{ ip: string, mac: string, deviceId: string, poolId: string }} DhcpLease
 * @typedef {{ id: string, name: string, type: 'A', value: string }} DnsRecord
 * @typedef {'ip' | 'icmp' | 'tcp' | 'udp'} AclProtocol
 * @typedef {{ id: string, seq: number, action: 'permit' | 'deny', protocol: AclProtocol, src: string, srcPrefix: number, dst: string, dstPrefix: number, port?: number, remark?: string }} AclRule
 * @typedef {{ name: string, rules: AclRule[] }} Acl
 *
 * @typedef {Object} NetworkState
 * @property {number} version
 * @property {Segment[]} segments
 * @property {Device[]} devices
 * @property {Link[]} links
 * @property {{ serverDeviceId: string, enabled: boolean, pools: DhcpPool[], leases: DhcpLease[] }} dhcp
 * @property {{ serverDeviceId: string, enabled: boolean, domain: string, records: DnsRecord[] }} dns
 * @property {Acl[]} acls
 *
 * @typedef {'icmp' | 'tcp' | 'udp'} TransportProtocol
 */
export {}
