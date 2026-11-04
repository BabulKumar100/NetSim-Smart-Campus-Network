import {
  BookOpen,
  Cable,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Layers,
  Network,
  Route,
  Server,
  Shield,
  Stethoscope,
  Waypoints,
} from 'lucide-react'

export const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: LayoutDashboard, summary: 'Project summary and simulation results dashboard' },
  { href: '/topology', label: 'Network Topology', icon: Network, summary: 'Interactive campus topology and device inspector' },
  { href: '/addressing', label: 'IP Addressing', icon: Waypoints, summary: 'Subnet table, address validation and VLSM calculator' },
  { href: '/vlans', label: 'VLAN Configuration', icon: Cable, summary: 'VLAN design, switch ports, trunks and Cisco IOS configuration' },
  { href: '/services', label: 'DHCP and DNS', icon: Server, summary: 'DORA demonstration, pools, leases and DNS lookups' },
  { href: '/packet-flow', label: 'Packet Flow', icon: Route, summary: 'Step-by-step packet journey through the model' },
  { href: '/connectivity', label: 'Connectivity Testing', icon: Stethoscope, summary: 'Simulated ping and connectivity tests' },
  { href: '/models', label: 'OSI and TCP/IP Models', icon: Layers, summary: 'Layer explorer and encapsulation sequence' },
  { href: '/troubleshooting', label: 'Troubleshooting', icon: GraduationCap, summary: 'Fault-injection lab with verified fixes' },
  { href: '/security', label: 'Network Security', icon: Shield, summary: 'Security basics and ACL policy demonstration' },
  { href: '/documentation', label: 'Documentation', icon: FileText, summary: 'Report, Packet Tracer guide, test plan and viva' },
  { href: '/about', label: 'About Project', icon: BookOpen, summary: 'Academic project information' },
]
