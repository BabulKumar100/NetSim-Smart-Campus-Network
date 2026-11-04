import { useState } from 'react'
import { ArrowDown, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Classic OSI model mapped onto the decision points the simulation actually models. */
export const OSI_LAYERS = [
  {
    id: 'L7',
    number: 7,
    name: 'Application',
    tcpip: 'Application',
    pdu: 'Data',
    addressing: 'Host name (DNS)',
    devices: 'Hosts, servers',
    examples: 'HTTP, DNS, DHCP, SMTP, SSH',
    tint: 'var(--success)',
    detail:
      'The user-facing protocol layer. The portal request, a DNS lookup or a DHCP exchange all originate here, where an application name is resolved to the address a lower layer can use.',
  },
  {
    id: 'L6',
    number: 6,
    name: 'Presentation',
    tcpip: 'Application',
    pdu: 'Data',
    addressing: '—',
    devices: 'Hosts, servers',
    examples: 'TLS, encoding, compression',
    tint: 'var(--info)',
    detail:
      'Formats, encrypts and compresses data so both sides agree on the wire format. HTTPS on the campus portal is the practical example of this layer at work.',
  },
  {
    id: 'L5',
    number: 5,
    name: 'Session',
    tcpip: 'Application',
    pdu: 'Data',
    addressing: '—',
    devices: 'Hosts, servers',
    examples: 'Session setup, keep-alive',
    tint: 'var(--violet)',
    detail: 'Establishes, manages and tears down conversations between applications so a long transfer can be resumed and kept in order.',
  },
  {
    id: 'L4',
    number: 4,
    name: 'Transport',
    tcpip: 'Transport',
    pdu: 'Segment (TCP) / Datagram (UDP)',
    addressing: 'Port numbers',
    devices: 'Hosts',
    examples: 'TCP 443, UDP 53, UDP 67/68',
    tint: 'var(--violet)',
    detail:
      'Adds source and destination ports so the right application gets the data. DHCP uses UDP 67/68 and DNS uses UDP 53; the simulation labels every packet with these ports.',
  },
  {
    id: 'L3',
    number: 3,
    name: 'Network',
    tcpip: 'Internet',
    pdu: 'Packet',
    addressing: 'IPv4 address + subnet',
    devices: 'Routers, Layer 3 devices',
    examples: 'IP, ICMP, ARP is L2',
    tint: 'var(--primary)',
    detail:
      'Adds the source and destination IPv4 address and the TTL. Gateways, longest-prefix routing, ACLs and NAT are all Layer 3 decisions that decide whether a packet lives or dies.',
  },
  {
    id: 'L2',
    number: 2,
    name: 'Data Link',
    tcpip: 'Network Access',
    pdu: 'Frame',
    addressing: 'MAC address + VLAN tag',
    devices: 'Switches, access points',
    examples: 'Ethernet, 802.1Q, 802.11',
    tint: 'var(--info)',
    detail:
      'Wraps the packet in a frame with source and destination MAC addresses. Switches forward by MAC inside a VLAN, and VLAN tags keep broadcast domains separate.',
  },
  {
    id: 'L1',
    number: 1,
    name: 'Physical',
    tcpip: 'Network Access',
    pdu: 'Bit',
    addressing: '—',
    devices: 'Cables, ports, radio',
    examples: 'UTP copper, straight/cross, radio',
    tint: 'var(--muted-foreground)',
    detail:
      'Moves raw bits across copper or radio. Link state ("no shutdown", cable present, Wi-Fi associated) is checked here before anything else can work.',
  },
]

/** Click-through encapsulation explorer: pick a layer to see its PDU, addressing and example protocols. */
export function OsiStack() {
  const [active, setActive] = useState('L3')
  const layer = OSI_LAYERS.find((l) => l.id === active) ?? OSI_LAYERS[3]
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <ol className="space-y-1.5">
        {OSI_LAYERS.map((l, i) => {
          const selected = l.id === active
          return (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => setActive(l.id)}
                aria-pressed={selected}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all',
                  selected ? 'border-primary/50 bg-accent shadow-sm' : 'border-border/60 hover:border-primary/30 hover:bg-muted/50',
                )}
              >
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-md font-mono text-sm font-bold"
                  style={{
                    background: `color-mix(in oklab, ${l.tint} 16%, transparent)`,
                    color: `color-mix(in oklab, ${l.tint} 80%, var(--foreground))`,
                  }}
                >
                  {l.number}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{l.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">PDU: {l.pdu}</span>
                </span>
                <span className="hidden shrink-0 rounded border border-border/60 bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:block">
                  {l.tcpip}
                </span>
                {i < OSI_LAYERS.length - 1 ? <ArrowDown className="hidden size-3 text-muted-foreground/40" aria-hidden="true" /> : null}
              </button>
            </li>
          )
        })}
      </ol>

      <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-semibold">
            Layer {layer.number} · {layer.name}
          </h3>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{layer.detail}</p>
        <dl className="mt-4 grid gap-2 sm:grid-cols-2">
          {[
            ['OSI layer', `L${layer.number} ${layer.name}`],
            ['TCP/IP layer', layer.tcpip],
            ['PDU', layer.pdu],
            ['Addressing', layer.addressing],
            ['Devices', layer.devices],
            ['Examples', layer.examples],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border/60 bg-card px-3 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 text-sm">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
