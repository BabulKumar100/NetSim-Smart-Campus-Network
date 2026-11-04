import { Link, useLocation } from 'react-router-dom'
import { useMemo, useState } from 'react'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bug,
  Cable,
  CheckCircle2,
  CircleAlert,
  Clock,
  FlaskConical,
  Gauge,
  GraduationCap,
  Layers,
  Lightbulb,
  Network,
  Play,
  RefreshCw,
  Route,
  Server,
  Shield,
  ShieldCheck,
  Stethoscope,
  Terminal,
  Waypoints,
  Wrench,
} from 'lucide-react'
import { NAV_ITEMS } from '@/lib/nav'
import { useNetwork } from '@/lib/network/store'
import { validateNetwork } from '@/lib/network/state'
import { generateConfigs, COMMAND_EXPLANATIONS } from '@/lib/network/ios'
import { testConnectivity, evaluateAcl } from '@/lib/network/engine'
import { dnsLookup, requestDhcp } from '@/lib/network/services'
import { SCENARIOS, checkScenario } from '@/lib/network/scenarios'
import { runDiagnostic, commandLabel } from '@/lib/network/show'
import { calculateVlsm, inSubnet, isValidIp, prefixToMask, subnetInfo } from '@/lib/network/ip'
import { getDevice } from '@/lib/network/l2'
import { nslookupTranscript } from '@/lib/visual'
import { TopologyCanvas, useDeviceStatus, statusLabel } from '@/components/network/topology-canvas'
import { LinkLegend } from '@/components/network/link-legend'
import { DoraSequence } from '@/components/network/dora-sequence'
import { OsiStack } from '@/components/network/osi-stack'
import { PathRibbon, StepTimeline } from '@/components/network/step-timeline'
import {
  Callout,
  CodeBlock,
  DeviceOptions,
  Field,
  KeyValue,
  Mono,
  NativeSelect,
  Panel,
  SectionHeader,
  SimulatedBadge,
  StatusPill,
} from '@/components/network/primitives'

const META = {
  topology: {
    title: 'Network Topology',
    description: 'Inspect the simulated physical and logical campus layout. Select devices to see interfaces, addresses and service roles.',
    icon: Network,
  },
  addressing: {
    title: 'IP Addressing',
    description: 'Review the IPv4 plan, subnet boundaries and host assignments used by the campus network.',
    icon: Waypoints,
  },
  vlans: {
    title: 'VLAN Configuration',
    description: 'See how access ports, trunks and router-on-a-stick subinterfaces divide the broadcast domains.',
    icon: Cable,
  },
  services: { title: 'DHCP and DNS', description: 'Run the DORA exchange, inspect leases and test campus DNS resolution.', icon: Server },
  'packet-flow': {
    title: 'Packet Flow',
    description: 'Trace a packet one decision at a time through Ethernet, ARP, routing, ACL and NAT.',
    icon: Route,
  },
  connectivity: {
    title: 'Connectivity Testing',
    description: 'Run simulated ICMP, TCP and UDP checks and inspect the request and reply paths.',
    icon: Stethoscope,
  },
  models: {
    title: 'OSI and TCP/IP Models',
    description: 'Connect application data to encapsulation, addressing and forwarding decisions.',
    icon: Layers,
  },
  troubleshooting: {
    title: 'Troubleshooting Lab',
    description: 'Inject realistic faults, follow a diagnostic procedure and verify the corrected configuration.',
    icon: FlaskConical,
  },
  security: {
    title: 'Network Security',
    description: 'Explore the Wi-Fi ACL policy, management hardening and practical defense-in-depth controls.',
    icon: Shield,
  },
  documentation: {
    title: 'Documentation',
    description: 'A compact viva guide, test plan, Packet Tracer build sequence and report-ready project summary.',
    icon: BookOpen,
  },
  about: {
    title: 'About Project',
    description: 'Academic project scope, assumptions, learning outcomes and simulation boundaries.',
    icon: BookOpen,
  },
}

const PRIMARY_BTN =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90'
const GHOST_BTN =
  'inline-flex items-center gap-1.5 rounded-lg border bg-card px-3.5 py-2 text-sm font-medium transition-colors hover:bg-muted'
const SEGMENT_TINT = {
  cse: 'var(--chart-1)',
  admin: 'var(--chart-4)',
  library: 'var(--chart-3)',
  servers: 'var(--chart-5)',
  wifi: 'var(--chart-2)',
}

function Header({ slug }) {
  const m = META[slug]
  const Icon = m.icon
  return (
    <SectionHeader title={m.title} description={m.description}>
      <SimulatedBadge />
      <Icon className="size-5 text-primary" aria-hidden="true" />
    </SectionHeader>
  )
}

function BackLink() {
  return (
    <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-3" /> Overview
    </Link>
  )
}

/* ── Network Topology ─────────────────────────────────────────────────────── */

function TopologyPage() {
  const { network } = useNetwork()
  const [selected, setSelected] = useState('R1')
  const device = network.devices.find((d) => d.id === selected)
  const status = useDeviceStatus(network)
  const st = device ? (status.get(device.id) ?? 'off') : null
  const links = device ? network.links.filter((l) => l.a.device === device.id || l.b.device === device.id) : []
  const { record } = useNetwork()
  const [traceSrc, setTraceSrc] = useState('CSE-PC1')
  const [traceDst, setTraceDst] = useState('SRV-CORE')
  const [trace, setTrace] = useState(null)
  const [replay, setReplay] = useState(0)
  const runTrace = () => {
    const r = testConnectivity(network, { sourceId: traceSrc, destination: { deviceId: traceDst } })
    setTrace(r)
    setReplay((n) => n + 1)
    record({
      kind: 'flow',
      label: `${traceSrc} → ${traceDst}`,
      success: r.success,
      sent: 1,
      received: r.success ? 1 : 0,
      detail: r.summary,
    })
  }

  return (
    <div className="space-y-5">
      <Header slug="topology" />
      <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <div className="space-y-3">
          <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-end">
            <Field label="Trace from" htmlFor="topo-src">
              <NativeSelect id="topo-src" value={traceSrc} onChange={(e) => setTraceSrc(e.target.value)}>
                <DeviceOptions state={network} filter={(d) => Boolean(d.host)} />
              </NativeSelect>
            </Field>
            <Field label="To" htmlFor="topo-dst">
              <NativeSelect id="topo-dst" value={traceDst} onChange={(e) => setTraceDst(e.target.value)}>
                <DeviceOptions state={network} filter={(d) => Boolean(d.host || d.type === 'router')} />
              </NativeSelect>
            </Field>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={runTrace} className={`${PRIMARY_BTN} h-9`}>
                <Route className="size-4" aria-hidden="true" /> Trace packet
              </button>
              {trace ? (
                <button type="button" onClick={() => setTrace(null)} className={`${GHOST_BTN} h-9`}>
                  Clear
                </button>
              ) : null}
            </div>
          </div>
          <TopologyCanvas
            state={network}
            selectedId={selected}
            onSelect={setSelected}
            highlightPath={trace?.forward.path}
            packetFailed={trace ? !trace.success : undefined}
            replayKey={replay}
            className="aspect-[1000/540] w-full"
          />
          {trace ? (
            <div className="animate-fade-up flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3" aria-live="polite">
              <StatusPill tone={trace.success ? 'success' : 'fail'}>{trace.success ? 'DELIVERED' : 'DROPPED'}</StatusPill>
              <Mono>
                {trace.sourceIp} → {trace.destinationIp}
              </Mono>
              <PathRibbon path={trace.forward.path} />
              {!trace.success && trace.forward.reason ? <p className="w-full text-xs text-destructive">{trace.forward.reason}</p> : null}
            </div>
          ) : null}
        </div>
        <div className="space-y-5">
          <Panel title="Device inspector" description="Select any node in the topology to inspect it.">
            {device ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold">{device.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {device.model} · {device.type}
                    </p>
                  </div>
                  <StatusPill tone={device.online ? (st === 'ok' ? 'success' : 'warn') : 'fail'}>
                    {device.online ? (st === 'ok' ? 'Healthy' : 'Degraded') : 'Offline'}
                  </StatusPill>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{device.description}</p>
                <KeyValue
                  items={[
                    ['Zone', device.zone],
                    ['Status', st ? statusLabel(st, device) : '—'],
                    ['MAC', <Mono key="mac">{device.mac}</Mono>],
                    ['IP', <Mono key="ip">{device.host?.ip || device.interfaces?.map((i) => i.ip).join(', ') || 'Layer 2 only'}</Mono>],
                    ['Services', device.services?.join(', ') || '—'],
                    ['Links', String(links.length)],
                  ]}
                />
                {device.host ? (
                  <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Addressing</p>
                    <KeyValue
                      items={[
                        ['Mode', device.host.mode === 'dhcp' ? 'DHCP' : 'Static'],
                        [
                          'Mask',
                          <Mono key="m">
                            {prefixToMask(device.host.prefix)} (/{device.host.prefix})
                          </Mono>,
                        ],
                        ['Gateway', <Mono key="g">{device.host.gateway || '—'}</Mono>],
                        ['DNS', <Mono key="d">{device.host.dns || '—'}</Mono>],
                      ]}
                    />
                  </div>
                ) : null}
                {device.interfaces ? (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Interfaces</h3>
                    <div className="space-y-1.5">
                      {device.interfaces.map((i) => (
                        <div key={i.name} className="rounded-lg border border-border/60 p-2.5 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <Mono>{i.name}</Mono>
                            <div className="flex items-center gap-1.5">
                              {i.nat ? <StatusPill tone="info">NAT {i.nat}</StatusPill> : null}
                              {i.aclIn ? <StatusPill tone="warn">ACL</StatusPill> : null}
                              <StatusPill tone={i.up ? 'success' : 'fail'}>{i.up ? 'up' : 'down'}</StatusPill>
                            </div>
                          </div>
                          <p className="mt-1 text-muted-foreground">
                            <Mono>
                              {i.ip}/{i.prefix}
                            </Mono>
                            {i.vlan ? ` · VLAN ${i.vlan}` : ''}
                            {i.description ? ` · ${i.description}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No device selected. Click a node in the topology.</p>
            )}
          </Panel>

          <Panel title="Link legend" description="Lines represent simulated links. Colours follow the link role.">
            <LinkLegend cols={2} />
          </Panel>
        </div>
      </div>
    </div>
  )
}

/* ── IP Addressing ────────────────────────────────────────────────────────── */

function segmentUsage(network, seg) {
  const ips = new Set()
  const hosts = []
  const infra = []
  for (const d of network.devices) {
    if (d.host && isValidIp(d.host.ip) && inSubnet(d.host.ip, seg.network, seg.prefix)) {
      ips.add(d.host.ip)
      hosts.push({ name: d.name, ip: d.host.ip, mode: d.host.mode })
    }
    for (const f of d.interfaces ?? []) {
      if (isValidIp(f.ip) && inSubnet(f.ip, seg.network, seg.prefix)) {
        ips.add(f.ip)
        infra.push(`${d.id} ${f.name}`)
      }
    }
  }
  for (const l of network.dhcp.leases) if (inSubnet(l.ip, seg.network, seg.prefix)) ips.add(l.ip)
  const pool = network.dhcp.pools.find((p) => p.network === seg.network && p.prefix === seg.prefix)
  return { used: ips.size, hosts, infra, pool }
}

function SegmentCard({ seg, network }) {
  const tint = SEGMENT_TINT[seg.id] ?? 'var(--primary)'
  const info = subnetInfo(seg.network, seg.prefix)
  const { used, hosts, pool } = segmentUsage(network, seg)
  const usable = info?.usableHosts ?? 254
  const pct = Math.min(100, Math.round((used / usable) * 100))
  return (
    <div
      className="animate-fade-up rounded-xl border bg-card p-4"
      style={{ borderColor: `color-mix(in oklab, ${tint} 30%, var(--border))` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold">
            <span
              className="rounded px-1.5 py-0.5 font-mono text-[11px]"
              style={{
                background: `color-mix(in oklab, ${tint} 18%, transparent)`,
                color: `color-mix(in oklab, ${tint} 85%, var(--foreground))`,
              }}
            >
              VLAN {seg.vlan}
            </span>
            <span className="truncate">{seg.short}</span>
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{seg.name}</p>
        </div>
        <StatusPill tone="info">
          {used}/{usable}
        </StatusPill>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: tint }} />
      </div>
      <KeyValue
        items={[
          [
            'Network',
            <Mono key="n">
              {seg.network}/{seg.prefix}
            </Mono>,
          ],
          ['Mask', <Mono key="m">{info?.mask ?? '255.255.255.0'}</Mono>],
          ['Gateway', <Mono key="g">{seg.gateway}</Mono>],
          ['Pool', <Mono key="p">{pool?.name ?? 'none'}</Mono>],
        ]}
      />
      <p className="mt-3 text-[11px] text-muted-foreground">
        {hosts.length} host(s) · {Math.max(0, usable - used)} addresses free
      </p>
    </div>
  )
}

function VlsmCalculator() {
  const [base, setBase] = useState('10.20.0.0')
  const [prefix, setPrefix] = useState('22')
  const [rows, setRows] = useState([
    { id: 1, name: 'CSE Lab', hosts: '100' },
    { id: 2, name: 'Administration', hosts: '50' },
    { id: 3, name: 'Library', hosts: '30' },
    { id: 4, name: 'Campus Wi-Fi', hosts: '60' },
  ])

  const result = useMemo(() => {
    const p = Number(prefix)
    if (!Number.isInteger(p)) return { ok: false, error: 'Enter a whole-number prefix length between 0 and 30.' }
    return calculateVlsm(
      base.trim(),
      p,
      rows.map((r) => ({ name: r.name.trim() || 'Unnamed', hosts: Number(r.hosts) })),
    )
  }, [base, prefix, rows])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1.4fr_0.6fr]">
        <Field label="Base network address" htmlFor="vlsm-base" hint="RFC 1918 private space, e.g. 10.20.0.0">
          <input
            id="vlsm-base"
            value={base}
            onChange={(e) => setBase(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-card px-2.5 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          />
        </Field>
        <Field label="Base prefix" htmlFor="vlsm-prefix" hint="/0 – /30">
          <input
            id="vlsm-prefix"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-card px-2.5 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          />
        </Field>
      </div>

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={row.id} className="flex items-center gap-2">
            <input
              aria-label={`Requirement ${i + 1} name`}
              value={row.name}
              onChange={(e) => setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, name: e.target.value } : r)))}
              className="h-9 flex-1 rounded-md border border-input bg-card px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />
            <input
              aria-label={`Requirement ${i + 1} hosts`}
              inputMode="numeric"
              value={row.hosts}
              onChange={(e) => setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, hosts: e.target.value } : r)))}
              className="h-9 w-24 rounded-md border border-input bg-card px-2.5 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />
            <button
              type="button"
              onClick={() => setRows((rs) => rs.filter((r) => r.id !== row.id))}
              className="rounded-md border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
              aria-label={`Remove ${row.name}`}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setRows((rs) => [...rs, { id: Date.now(), name: '', hosts: '10' }])}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
        >
          <ArrowRight className="size-3" aria-hidden="true" /> Add requirement
        </button>
      </div>

      {!result.ok ? (
        <Callout tone="warn" title="Cannot allocate">
          {result.error}
        </Callout>
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="p-2">Department</th>
                  <th className="p-2">Subnet</th>
                  <th className="p-2">Mask</th>
                  <th className="p-2">Usable</th>
                  <th className="p-2">Requested</th>
                  <th className="p-2">Wasted</th>
                  <th className="p-2">Host range</th>
                </tr>
              </thead>
              <tbody>
                {result.allocations.map((a) => (
                  <tr key={a.name} className="border-b last:border-0">
                    <td className="p-2 font-medium">{a.name}</td>
                    <td className="p-2">
                      <Mono>
                        {a.network}/{a.prefix}
                      </Mono>
                    </td>
                    <td className="p-2">
                      <Mono>{a.mask}</Mono>
                    </td>
                    <td className="p-2 tabular-nums">{a.usableHosts}</td>
                    <td className="p-2 tabular-nums">{a.requestedHosts}</td>
                    <td className="p-2 tabular-nums text-muted-foreground">{a.wastedAddresses}</td>
                    <td className="p-2">
                      <Mono>
                        {a.firstUsable} – {a.lastUsable}
                      </Mono>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Allocated <b className="text-foreground">{result.usedAddresses}</b> of {result.usedAddresses + result.freeAddresses} addresses ·{' '}
            <b className="text-foreground">{result.freeAddresses}</b> free in the block.
          </p>
        </div>
      )}
    </div>
  )
}

function AddressingPage() {
  const { network } = useNetwork()
  const errors = validateNetwork(network)
  return (
    <div className="space-y-5">
      <Header slug="addressing" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {network.segments.map((seg) => (
          <SegmentCard key={seg.id} seg={seg} network={network} />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="VLAN-wise IP allocation" description="Every address currently assigned by the model, grouped by broadcast domain.">
          <div className="space-y-3">
            {network.segments.map((seg) => {
              const { hosts, infra, pool } = segmentUsage(network, seg)
              return (
                <div key={seg.id} className="rounded-lg border border-border/60 p-3">
                  <p className="text-xs font-semibold">
                    {seg.short} · VLAN {seg.vlan}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {hosts.length === 0 && infra.length === 0 ? (
                      <li className="text-xs text-muted-foreground">No addresses assigned.</li>
                    ) : null}
                    {hosts.map((h) => (
                      <li key={h.name} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate">{h.name}</span>
                        <span className="flex items-center gap-2">
                          <Mono>{h.ip}</Mono>
                          <StatusPill tone={h.mode === 'dhcp' ? 'info' : 'neutral'}>{h.mode}</StatusPill>
                        </span>
                      </li>
                    ))}
                    {infra.map((i) => (
                      <li key={i} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{i}</span>
                        <StatusPill tone="warn">gateway</StatusPill>
                      </li>
                    ))}
                  </ul>
                  {pool ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      DHCP pool <b>{pool.name}</b> · excludes {pool.excludedStart}–{pool.excludedEnd}
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Address audit" description="Live validation of the configured plan.">
            {errors.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="size-4" aria-hidden="true" /> All addresses, gateways and subnet boundaries are valid.
              </div>
            ) : (
              <div className="space-y-2">
                {errors.map((issue, i) => (
                  <div
                    key={`${issue.subject}-${i}`}
                    className="flex gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-2 text-sm"
                  >
                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
                    <span>
                      <b>{issue.subject}:</b> {issue.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="VLSM calculator" description="Variable-length subnet masking: allocate a base block to departments largest-first.">
            <VlsmCalculator />
          </Panel>
        </div>
      </div>
    </div>
  )
}

/* ── VLAN Configuration ───────────────────────────────────────────────────── */

function VlansPage() {
  const { network } = useNetwork()
  const configs = useMemo(() => generateConfigs(network), [network])
  const [deviceId, setDeviceId] = useState('R1')
  const config = configs.find((c) => c.deviceId === deviceId) ?? configs[0]

  return (
    <div className="space-y-5">
      <Header slug="vlans" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {network.segments.map((seg) => {
          const tint = SEGMENT_TINT[seg.id] ?? 'var(--primary)'
          const accessPorts = network.links.filter((l) => l.mode === 'access' && l.vlan === seg.vlan).length
          const trunks = network.links.filter((l) => l.mode === 'trunk' && (l.allowedVlans ?? []).includes(seg.vlan)).length
          return (
            <div
              key={seg.id}
              className="animate-fade-up rounded-xl border bg-card p-4"
              style={{ borderColor: `color-mix(in oklab, ${tint} 30%, var(--border))` }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="rounded px-2 py-0.5 font-mono text-sm font-semibold"
                  style={{
                    background: `color-mix(in oklab, ${tint} 20%, transparent)`,
                    color: `color-mix(in oklab, ${tint} 85%, var(--foreground))`,
                  }}
                >
                  {seg.vlan}
                </span>
                <span className="text-sm font-semibold">{seg.short}</span>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">{seg.name}</p>
              <KeyValue
                items={[
                  [
                    'Subnet',
                    <Mono key="n">
                      {seg.network}/{seg.prefix}
                    </Mono>,
                  ],
                  ['Gateway', <Mono key="g">{seg.gateway}</Mono>],
                ]}
              />
              <div className="mt-3 flex flex-wrap gap-1.5">
                <StatusPill tone="neutral">
                  {accessPorts} access port{accessPorts === 1 ? '' : 's'}
                </StatusPill>
                <StatusPill tone="info">
                  {trunks} trunk{trunks === 1 ? '' : 's'}
                </StatusPill>
              </div>
            </div>
          )
        })}
      </div>

      <Panel title="Switch port plan" description="Access ports carry one VLAN untagged; trunks carry the allowed VLANs with 802.1Q tags.">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th className="p-2">Link</th>
                <th className="p-2">A side</th>
                <th className="p-2">B side</th>
                <th className="p-2">Mode</th>
                <th className="p-2">VLANs</th>
                <th className="p-2">State</th>
              </tr>
            </thead>
            <tbody>
              {network.links.map((l) => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="p-2">
                    <Mono>{l.id}</Mono>
                  </td>
                  <td className="p-2 text-xs">
                    <Mono>
                      {l.a.device} {l.a.port}
                    </Mono>
                  </td>
                  <td className="p-2 text-xs">
                    <Mono>
                      {l.b.device} {l.b.port}
                    </Mono>
                  </td>
                  <td className="p-2">
                    <StatusPill tone={l.mode === 'trunk' ? 'info' : l.mode === 'wireless' ? 'warn' : 'neutral'}>{l.mode}</StatusPill>
                  </td>
                  <td className="p-2">
                    <Mono>{l.mode === 'access' ? String(l.vlan ?? '—') : (l.allowedVlans ?? []).join(', ') || '—'}</Mono>
                  </td>
                  <td className="p-2">
                    <StatusPill tone={l.up ? 'success' : 'fail'}>{l.up ? 'up' : 'down'}</StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="Router and switch configuration"
        description="Generated Cisco IOS configuration derived from the live model."
        actions={
          <NativeSelect value={deviceId} onChange={(e) => setDeviceId(e.target.value)} className="w-44" aria-label="Configuration device">
            {configs.map((c) => (
              <option key={c.deviceId} value={c.deviceId}>
                {c.title}
              </option>
            ))}
          </NativeSelect>
        }
      >
        <CodeBlock code={config?.config ?? ''} label={`${config?.title ?? ''} running-config`} />
      </Panel>
    </div>
  )
}

/* ── DHCP and DNS ─────────────────────────────────────────────────────────── */

function ServicesPage() {
  const { network, setNetwork, record } = useNetwork()
  const [client, setClient] = useState('CSE-PC1')
  const [dnsClient, setDnsClient] = useState('CSE-PC1')
  const [name, setName] = useState('portal.campus.local')
  const [dhcpResult, setDhcpResult] = useState(null)
  const [dnsResult, setDnsResult] = useState(null)

  const runDhcp = () => {
    const r = requestDhcp(network, client)
    setNetwork(r.state)
    setDhcpResult(r)
    record({ kind: 'dhcp', label: `DHCP ${client}`, success: r.ok, sent: 1, received: r.ok ? 1 : 0, detail: r.reason ?? 'DORA completed' })
  }
  const runDns = () => {
    const r = dnsLookup(network, dnsClient, name)
    setDnsResult(r)
    record({
      kind: 'dns',
      label: `DNS ${name}`,
      success: r.status === 'resolved',
      sent: 1,
      received: r.status === 'resolved' ? 1 : 0,
      detail: r.explanation,
    })
  }

  const server = getDevice(network, network.dhcp.serverDeviceId)

  return (
    <div className="space-y-5">
      <Header slug="services" />

      <Panel
        title="DHCP — DORA exchange"
        description="Select a client and replay Discover → Offer → Request → Acknowledge against the live model."
        actions={
          <StatusPill tone={network.dhcp.enabled ? 'success' : 'fail'}>
            {network.dhcp.enabled ? 'Service enabled' : 'Service disabled'}
          </StatusPill>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
          <div className="space-y-3">
            <Field label="DHCP client" htmlFor="dhcp-client">
              <NativeSelect id="dhcp-client" value={client} onChange={(e) => setClient(e.target.value)}>
                <DeviceOptions state={network} filter={(d) => Boolean(d.host?.mode === 'dhcp')} />
              </NativeSelect>
            </Field>
            <button type="button" onClick={runDhcp} className={PRIMARY_BTN}>
              <Play className="size-4" aria-hidden="true" /> Run DORA
            </button>
            <p className="text-xs text-muted-foreground">
              Server: <b>{server?.name ?? '—'}</b> · {network.dhcp.pools.length} pools · {network.dhcp.leases.length} active lease(s)
            </p>
          </div>

          <div>
            {dhcpResult ? (
              <div className="space-y-4">
                <DoraSequence steps={dhcpResult.steps} />
                {dhcpResult.ok && dhcpResult.lease ? (
                  <div className="rounded-lg border border-success/30 bg-success/5 p-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-success">
                      <CheckCircle2 className="size-4" aria-hidden="true" /> Lease granted
                    </p>
                    <KeyValue
                      items={[
                        ['Address', <Mono key="a">{dhcpResult.lease.ip}</Mono>],
                        ['Pool', dhcpResult.pool?.name ?? '—'],
                        ['Gateway', <Mono key="g">{dhcpResult.pool?.defaultRouter ?? '—'}</Mono>],
                        ['DNS', <Mono key="d">{dhcpResult.pool?.dnsServer ?? '—'}</Mono>],
                        ['MAC', <Mono key="m">{dhcpResult.lease.mac}</Mono>],
                      ]}
                    />
                  </div>
                ) : dhcpResult.reason ? (
                  <Callout tone="fail" title="No lease">
                    {dhcpResult.reason}
                  </Callout>
                ) : null}
              </div>
            ) : (
              <Callout title="What is simulated">
                The DORA messages, pool selection, exclusions and APIPA fallback are modelled locally. No real DHCP server is contacted.
              </Callout>
            )}
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="DHCP pools and leases" description="Excluded ranges are reserved for gateways and static infrastructure.">
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-xs">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className="p-2">Pool</th>
                    <th className="p-2">Network</th>
                    <th className="p-2">Excluded</th>
                    <th className="p-2">Leases</th>
                  </tr>
                </thead>
                <tbody>
                  {network.dhcp.pools.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="p-2 font-medium">{p.name}</td>
                      <td className="p-2">
                        <Mono>
                          {p.network}/{p.prefix}
                        </Mono>
                      </td>
                      <td className="p-2">
                        <Mono>
                          {p.excludedStart}–{p.excludedEnd}
                        </Mono>
                      </td>
                      <td className="p-2 tabular-nums">{network.dhcp.leases.filter((l) => l.poolId === p.id).length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {network.dhcp.leases.length ? (
              <ul className="space-y-1.5">
                {network.dhcp.leases.map((l) => (
                  <li
                    key={`${l.deviceId}-${l.ip}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs"
                  >
                    <span>{getDevice(network, l.deviceId)?.name ?? l.deviceId}</span>
                    <span className="flex items-center gap-2">
                      <Mono>{l.ip}</Mono>
                      <StatusPill tone="info">leased</StatusPill>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No active leases. Run a DORA exchange to create one.</p>
            )}
          </div>
        </Panel>

        <Panel
          title="DNS — name resolution"
          description="A UDP port 53 query is routed through the model, then the server's A records are consulted."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Client" htmlFor="dns-client">
              <NativeSelect id="dns-client" value={dnsClient} onChange={(e) => setDnsClient(e.target.value)}>
                <DeviceOptions state={network} filter={(d) => Boolean(d.host)} />
              </NativeSelect>
            </Field>
            <Field label="Hostname" htmlFor="dns-name">
              <input
                id="dns-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-card px-2.5 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              />
            </Field>
          </div>
          <button type="button" onClick={runDns} className={`${PRIMARY_BTN} mt-3`}>
            <Play className="size-4" aria-hidden="true" /> Resolve name
          </button>

          {dnsResult ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={dnsResult.status === 'resolved' ? 'success' : 'fail'}>{dnsResult.status.toUpperCase()}</StatusPill>
                {dnsResult.address ? (
                  <Mono>
                    {dnsResult.name} → {dnsResult.address}
                  </Mono>
                ) : (
                  <Mono>{dnsResult.name}</Mono>
                )}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{dnsResult.explanation}</p>
              <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: 'Client query', value: dnsClient, ok: true },
                  { label: 'UDP 53 to resolver', value: dnsResult.dnsServer ?? '—', ok: Boolean(dnsResult.query?.success) },
                  {
                    label: 'A record lookup',
                    value: dnsResult.status === 'resolved' ? 'found' : dnsResult.status,
                    ok: dnsResult.status === 'resolved',
                  },
                  { label: 'Answer', value: dnsResult.address ?? 'none', ok: dnsResult.status === 'resolved' },
                ].map((stage, i) => (
                  <li
                    key={stage.label}
                    className={`animate-fade-up rounded-lg border p-2.5 ${stage.ok ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'}`}
                    style={{ animationDelay: `${i * 140}ms` }}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {i + 1}. {stage.label}
                    </p>
                    <p className={`mt-1 truncate font-mono text-xs ${stage.ok ? 'text-success' : 'text-destructive'}`}>{stage.value}</p>
                  </li>
                ))}
              </ol>
              {dnsResult.query ? <PathRibbon path={dnsResult.query.forward.path} className="pt-1" /> : null}
              <CodeBlock
                label={`${dnsClient}> nslookup`}
                code={nslookupTranscript(
                  dnsResult,
                  (() => {
                    const srv = getDevice(network, network.dns.serverDeviceId)
                    const rec = network.dns.records.find((r) => r.value === srv?.host?.ip)
                    return srv?.host?.ip ? { name: rec?.name ?? srv.name, ip: srv.host.ip } : undefined
                  })(),
                )}
              />
            </div>
          ) : null}

          <div className="mt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Zone records on {getDevice(network, network.dns.serverDeviceId)?.name}
            </h3>
            <ul className="space-y-1">
              {network.dns.records.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs">
                  <Mono>{r.name}</Mono>
                  <span className="flex items-center gap-2">
                    <StatusPill tone="neutral">{r.type}</StatusPill>
                    <Mono>{r.value}</Mono>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>
    </div>
  )
}

/* ── Packet Flow ──────────────────────────────────────────────────────────── */

function PacketFlowPage() {
  const { network, record } = useNetwork()
  const [source, setSource] = useState('CSE-PC1')
  const [destination, setDestination] = useState('SRV-CORE')
  const [result, setResult] = useState(null)
  const [view, setView] = useState('forward')

  const trace = () => {
    const r = testConnectivity(network, { sourceId: source, destination: { deviceId: destination } })
    setResult(r)
    setView('forward')
    setReplay((n) => n + 1)
    record({
      kind: 'flow',
      label: `${source} → ${destination}`,
      success: r.success,
      sent: 1,
      received: r.success ? 1 : 0,
      detail: r.summary,
    })
  }

  const [replay, setReplay] = useState(0)
  const steps = result ? (view === 'forward' ? result.forward.steps : (result.reply?.steps ?? [])) : []
  const activePath = result ? (view === 'forward' ? result.forward.path : (result.reply?.path ?? [])) : []
  const layerCounts = ['L7', 'L4', 'L3', 'L2', 'L1'].map((layer) => ({ layer, count: steps.filter((st) => st.layer === layer).length }))

  return (
    <div className="space-y-5">
      <Header slug="packet-flow" />

      <Panel
        title="Trace a packet"
        description="The engine walks the packet hop by hop: Ethernet framing, ARP, VLAN forwarding, routing, ACL and NAT."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <Field label="Source" htmlFor="flow-source">
            <NativeSelect id="flow-source" value={source} onChange={(e) => setSource(e.target.value)}>
              <DeviceOptions state={network} filter={(d) => Boolean(d.host)} />
            </NativeSelect>
          </Field>
          <Field label="Destination" htmlFor="flow-dest">
            <NativeSelect id="flow-dest" value={destination} onChange={(e) => setDestination(e.target.value)}>
              <DeviceOptions state={network} filter={(d) => Boolean(d.host || d.type === 'router')} />
            </NativeSelect>
          </Field>
          <button type="button" onClick={trace} className={PRIMARY_BTN}>
            <Play className="size-4" aria-hidden="true" /> Trace packet
          </button>
        </div>

        {result ? (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <StatusPill tone={result.success ? 'success' : 'fail'}>{result.success ? 'DELIVERED' : 'DROPPED'}</StatusPill>
              <Mono>
                {result.sourceIp} → {result.destinationIp}
              </Mono>
              {result.gatewayUsed ? (
                <span className="text-xs text-muted-foreground">
                  via gateway <Mono>{result.gatewayUsed}</Mono>
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{result.summary}</p>
          </>
        ) : null}
      </Panel>

      {result ? (
        <>
          <Panel
            title={view === 'forward' ? 'Request path through the topology' : 'Reply path through the topology'}
            description="The packet travels hop by hop along the exact path computed by the engine."
            actions={
              <button
                type="button"
                onClick={() => setReplay((n) => n + 1)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <RefreshCw className="size-3" aria-hidden="true" /> Replay
              </button>
            }
          >
            <TopologyCanvas
              state={network}
              highlightPath={activePath}
              packetFailed={view === 'forward' && !result.success}
              replayKey={replay}
              className="aspect-[1000/540] w-full"
            />
            <PathRibbon path={activePath} className="mt-3" />
          </Panel>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {layerCounts.map(({ layer, count }) => (
              <div
                key={layer}
                className={`rounded-xl border p-3 transition-colors ${count ? 'border-primary/30 bg-accent/40' : 'bg-card opacity-60'}`}
              >
                <p className="font-mono text-xs font-semibold text-primary">{layer}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{count}</p>
                <p className="text-[11px] text-muted-foreground">decision{count === 1 ? '' : 's'}</p>
              </div>
            ))}
          </div>

          <Panel
            title="Layer-by-layer decisions"
            description="Each step is tagged with the OSI layer where the decision is made."
            actions={
              result.reply ? (
                <div className="inline-flex overflow-hidden rounded-lg border">
                  {['forward', 'reply'].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setView(v)}
                      className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${view === v ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted'}`}
                    >
                      {v === 'forward' ? 'Request' : 'Reply'}
                    </button>
                  ))}
                </div>
              ) : undefined
            }
          >
            {steps.length ? (
              <StepTimeline steps={steps} />
            ) : (
              <p className="text-sm text-muted-foreground">No reply path — the request did not complete.</p>
            )}
          </Panel>
        </>
      ) : (
        <Panel title="Source and destination">
          <KeyValue
            items={[
              ['Source', <Mono key="s">{getDevice(network, source)?.host?.ip || '—'}</Mono>],
              [
                'Destination',
                <Mono key="d">
                  {getDevice(network, destination)?.host?.ip || getDevice(network, destination)?.interfaces?.[0]?.ip || '—'}
                </Mono>,
              ],
            ]}
          />
          <p className="mt-3 text-sm text-muted-foreground">
            Press “Trace packet” to walk the request from creation to delivery, then inspect the reply.
          </p>
          <TopologyCanvas state={network} selectedId={source} className="mt-4 aspect-[1000/540] w-full" compact />
        </Panel>
      )}
    </div>
  )
}

/* ── Connectivity Testing ─────────────────────────────────────────────────── */

function ResultStat({ label, value, tone = 'neutral', icon: Icon }) {
  const tint =
    tone === 'success' ? 'text-success' : tone === 'fail' ? 'text-destructive' : tone === 'info' ? 'text-primary' : 'text-muted-foreground'
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className={`size-4 ${tint}`} aria-hidden="true" />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function ConnectivityPage() {
  const { network, record } = useNetwork()
  const [source, setSource] = useState('CSE-PC1')
  const [destination, setDestination] = useState('SRV-CORE')
  const [protocol, setProtocol] = useState('icmp')
  const [port, setPort] = useState('443')
  const [result, setResult] = useState(null)

  const run = () => {
    const r = testConnectivity(network, {
      sourceId: source,
      destination: { deviceId: destination },
      protocol,
      dstPort: protocol === 'icmp' ? undefined : Number(port) || undefined,
    })
    setResult(r)
    record({ kind: 'ping', label: `${source} → ${destination}`, success: r.success, sent: r.sent, received: r.received, detail: r.summary })
  }

  return (
    <div className="space-y-5">
      <Header slug="connectivity" />

      <Panel title="Test configuration" description="Run a simulated end-to-end exchange and inspect the request and reply.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <Field label="Source" htmlFor="conn-source">
            <NativeSelect id="conn-source" value={source} onChange={(e) => setSource(e.target.value)}>
              <DeviceOptions state={network} filter={(d) => Boolean(d.host)} />
            </NativeSelect>
          </Field>
          <Field label="Destination" htmlFor="conn-dest">
            <NativeSelect id="conn-dest" value={destination} onChange={(e) => setDestination(e.target.value)}>
              <DeviceOptions state={network} filter={(d) => Boolean(d.host || d.type === 'router')} />
            </NativeSelect>
          </Field>
          <Field label="Protocol" htmlFor="conn-proto">
            <NativeSelect id="conn-proto" value={protocol} onChange={(e) => setProtocol(e.target.value)}>
              <option value="icmp">ICMP (ping)</option>
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
            </NativeSelect>
          </Field>
          <Field label="Destination port" htmlFor="conn-port" hint={protocol === 'icmp' ? 'Not used for ICMP' : undefined}>
            <input
              id="conn-port"
              value={port}
              disabled={protocol === 'icmp'}
              onChange={(e) => setPort(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-card px-2.5 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50"
            />
          </Field>
          <button type="button" onClick={run} className={`${PRIMARY_BTN} h-9 justify-center`}>
            <Play className="size-4" aria-hidden="true" /> Run test
          </button>
        </div>
      </Panel>

      {result ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ResultStat
              label="Result"
              value={result.success ? 'PASS' : 'FAIL'}
              tone={result.success ? 'success' : 'fail'}
              icon={result.success ? CheckCircle2 : CircleAlert}
            />
            <ResultStat
              label="Packets delivered"
              value={`${result.received}/${result.sent}`}
              tone={result.received === result.sent ? 'success' : 'fail'}
              icon={Activity}
            />
            <ResultStat label="Router hops" value={String(result.forward.routerHops)} tone="info" icon={Route} />
            <ResultStat
              label="Simulated RTT"
              value={result.simulatedRttMs ? `${result.simulatedRttMs} ms` : '—'}
              tone="info"
              icon={Clock}
            />
          </div>

          <Panel title="Result summary">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={result.success ? 'success' : 'fail'}>{result.success ? 'REACHABLE' : 'UNREACHABLE'}</StatusPill>
              <Mono>
                {result.sourceIp} → {result.destinationIp}
              </Mono>
              {result.gatewayUsed ? (
                <span className="text-xs text-muted-foreground">
                  gateway <Mono>{result.gatewayUsed}</Mono>
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{result.summary}</p>
            <PathRibbon path={result.forward.path} className="mt-3" />
            {!result.success && result.forward.reason ? (
              <div className="mt-3">
                <Callout tone="fail" title="Failure reason">
                  {result.forward.reason}
                </Callout>
              </div>
            ) : null}
          </Panel>

          <div className="grid gap-5 xl:grid-cols-2">
            <Panel title="Request path" description="Forward trace from the source.">
              <StepTimeline steps={result.forward.steps} />
            </Panel>
            <Panel title="Reply path" description="Return trace from the responder.">
              {result.reply?.steps?.length ? (
                <StepTimeline steps={result.reply.steps} />
              ) : (
                <p className="text-sm text-muted-foreground">No reply was generated because the request did not reach the destination.</p>
              )}
            </Panel>
          </div>
        </>
      ) : (
        <Callout title="Ready to test">
          Pick a source and destination, then run the test to see the request and reply paths with per-layer detail.
        </Callout>
      )}
    </div>
  )
}

/* ── OSI and TCP/IP Models ────────────────────────────────────────────────── */

function ModelsPage() {
  return (
    <div className="space-y-5">
      <Header slug="models" />
      <Panel title="Encapsulation explorer" description="Select a layer to see its PDU, addressing, devices and example protocols.">
        <OsiStack />
      </Panel>
      <Panel
        title="How one portal request uses every layer"
        description="The same packet observed from the application down to the wire, then back up."
      >
        <ol className="space-y-2">
          {[
            ['L7 Application', 'The browser asks for portal.campus.local.'],
            ['L4 Transport', 'A TCP segment is built for destination port 443 (or a UDP query for DNS on 53).'],
            ['L3 Network', 'The source and destination IPv4 addresses and a TTL are added; the host picks a gateway for remote subnets.'],
            ['L2 Data Link', 'ARP finds the next-hop MAC, an Ethernet frame is built and a VLAN tag is added.'],
            ['L1 Physical', 'Bits leave the NIC over copper or radio towards the access switch.'],
          ].map(([title, detail], i) => (
            <li key={title} className="flex gap-3 rounded-lg border border-border/60 p-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent font-mono text-xs font-bold text-primary">
                {5 - i}
              </span>
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  )
}

/* ── Troubleshooting Lab ──────────────────────────────────────────────────── */

function CheckSummary({ check, label }) {
  const tone = check.solved ? 'success' : check.testPassed ? 'warn' : 'fail'
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <StatusPill tone={tone}>{check.solved ? 'SOLVED' : check.testPassed ? 'PARTIAL' : 'FAILED'}</StatusPill>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{check.message}</p>
      <div className="mt-3 space-y-2">
        {check.ping ? (
          <KeyValue
            items={[
              ['Test', `ICMP ${check.ping.sent} packet(s)`],
              ['Delivered', `${check.ping.received}/${check.ping.sent}`],
              ['Hops', String(check.ping.forward.routerHops)],
            ]}
          />
        ) : null}
        {check.dns ? (
          <KeyValue
            items={[
              ['Query', check.dns.name],
              ['Status', check.dns.status],
              ['Answer', check.dns.address ?? 'none'],
            ]}
          />
        ) : null}
        {check.dhcp ? (
          <KeyValue
            items={[
              ['DHCP', check.dhcp.ok ? 'Lease obtained' : 'No lease'],
              ['Address', check.dhcp.lease?.ip ?? '—'],
            ]}
          />
        ) : null}
        {check.issues.length ? <p className="text-xs text-destructive">{check.issues.length} remaining configuration error(s).</p> : null}
      </div>
    </div>
  )
}

function TroubleshootingPage() {
  const { network, setNetwork, resetNetwork, record } = useNetwork()
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id)
  const [check, setCheck] = useState(null)
  const [before, setBefore] = useState(null)
  const [after, setAfter] = useState(null)
  const [reveal, setReveal] = useState(false)
  const [injected, setInjected] = useState(false)
  const [solvedIds, setSolvedIds] = useState([])

  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]
  const diagnostics = useMemo(
    () => scenario.diagnostics.map((cmd) => ({ label: commandLabel(cmd), code: runDiagnostic(network, cmd) })),
    [network, scenario],
  )

  const choose = (id) => {
    setScenarioId(id)
    setCheck(null)
    setBefore(null)
    setAfter(null)
    setReveal(false)
    setInjected(false)
  }
  const inject = () => {
    const next = scenario.inject(network)
    setNetwork(next)
    setCheck(null)
    setBefore(checkScenario(scenario, next))
    setAfter(null)
    setInjected(true)
    setReveal(false)
  }
  const applyFix = () => {
    setNetwork(scenario.fix(network))
    setCheck(null)
    setInjected(false)
  }
  const verify = () => {
    const r = checkScenario(scenario, network)
    setCheck(r)
    setAfter(r)
    if (r.solved) setSolvedIds((ids) => (ids.includes(scenario.id) ? ids : [...ids, scenario.id]))
    record({ kind: 'lab', label: scenario.title, success: r.solved, sent: 1, received: r.solved ? 1 : 0, detail: r.message })
  }
  const restore = () => {
    resetNetwork()
    setCheck(null)
    setBefore(null)
    setAfter(null)
    setReveal(false)
    setInjected(false)
  }

  return (
    <div className="space-y-5">
      <Header slug="troubleshooting" />

      <Panel
        title="Fault scenarios"
        description={`${SCENARIOS.length} verified faults built from the campus topology. Solved: ${solvedIds.length}/${SCENARIOS.length}.`}
        actions={
          <button type="button" onClick={restore} className={GHOST_BTN}>
            <RefreshCw className="size-4" aria-hidden="true" /> Restore defaults
          </button>
        }
      >
        <div
          className="mb-4 h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={SCENARIOS.length}
          aria-valuenow={solvedIds.length}
          aria-label="Scenarios solved"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-success transition-[width] duration-700"
            style={{ width: `${(solvedIds.length / SCENARIOS.length) * 100}%` }}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SCENARIOS.map((s, i) => {
            const active = s.id === scenarioId
            const solved = solvedIds.includes(s.id)
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => choose(s.id)}
                aria-pressed={active}
                className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-all ${active ? 'border-primary/50 bg-accent' : 'border-border/60 hover:border-primary/30 hover:bg-muted/50'}`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                  <span className="min-w-0 truncate text-sm font-medium">{s.title}</span>
                </span>
                {solved ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" /> : null}
              </button>
            )
          })}
        </div>
      </Panel>

      <Panel
        title="Lab workspace"
        description="Faults are injected into the live simulation. Read the console output, apply the correct change, then verify."
      >
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={inject} className={PRIMARY_BTN}>
            <Bug className="size-4" aria-hidden="true" /> Inject fault
          </button>
          <button type="button" onClick={applyFix} className={GHOST_BTN}>
            <Wrench className="size-4" aria-hidden="true" /> Apply fix
          </button>
          <button type="button" onClick={verify} className={PRIMARY_BTN}>
            <Play className="size-4" aria-hidden="true" /> Verify
          </button>
        </div>
        {check?.solved ? (
          <div
            key={`solved-${scenario.id}-${solvedIds.length}`}
            className="animate-fade-up mt-4 flex items-center gap-3 rounded-xl border border-success/40 bg-success/10 p-3"
            role="status"
          >
            <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-success/20 text-success">
              <span className="absolute inset-0 animate-pulse-ring rounded-full border-2 border-success" aria-hidden="true" />
              <CheckCircle2 className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-success">Scenario solved</p>
              <p className="text-xs text-muted-foreground">
                {scenario.title} verified against the live simulation · {solvedIds.length}/{SCENARIOS.length} complete.
              </p>
            </div>
          </div>
        ) : null}
        {injected ? (
          <div className="mt-4">
            <Callout tone="warn" title="Fault active">
              The scenario is now injected into the running network. Use the console output, apply the fix and press Verify.
            </Callout>
          </div>
        ) : null}
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Reported problem" description={scenario.title}>
          <p className="text-sm leading-relaxed">{scenario.symptoms}</p>
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Diagnostic procedure</h3>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
            {scenario.procedure.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
          <div className="mt-4">
            <Callout tone="info" title="Hint">
              {scenario.hint}
            </Callout>
          </div>
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Lightbulb className="size-3.5" aria-hidden="true" />
            {reveal ? 'Hide root cause and correction' : 'Reveal root cause and correction'}
          </button>
          {reveal ? (
            <div className="mt-3 space-y-3">
              <Callout tone="warn" title="Root cause">
                {scenario.cause}
              </Callout>
              <Callout tone="success" title="Correction">
                {scenario.correction}
              </Callout>
            </div>
          ) : null}
        </Panel>

        <Panel
          title="Console output"
          description="Simulated CLI and ipconfig output produced by the model, not captured from a real device."
        >
          <div className="space-y-3">
            {diagnostics.map((d) => (
              <CodeBlock key={d.label} code={d.code} label={d.label} />
            ))}
          </div>
        </Panel>
      </div>

      {before || after ? (
        <Panel
          title="Before and after"
          description="The scenario test is re-run against the injected fault and against the corrected configuration."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <CheckSummary label="Before fix" check={before ?? after} />
            <CheckSummary label="After verification" check={after ?? before} />
          </div>
        </Panel>
      ) : check ? (
        <CheckSummary label="Verification result" check={check} />
      ) : null}
    </div>
  )
}

/* ── Network Security ─────────────────────────────────────────────────────── */

function configSection(config, marker) {
  const lines = config.split('\n')
  const start = lines.findIndex((l) => l.includes(marker))
  if (start < 0) return ''
  const out = []
  for (let i = start; i < lines.length; i++) {
    if (i > start && lines[i].startsWith('! ----')) break
    out.push(lines[i])
  }
  return out.join('\n')
}

function AclTester() {
  const { network } = useNetwork()
  const acl = network.acls[0]
  const [srcId, setSrcId] = useState('LAPTOP-1')
  const [dstId, setDstId] = useState('ADM-PC1')
  const [protocol, setProtocol] = useState('icmp')
  const ipOf = (id) => {
    const d = getDevice(network, id)
    return d?.host?.ip || d?.interfaces?.[0]?.ip || ''
  }
  const srcIp = ipOf(srcId)
  const dstIp = ipOf(dstId)
  const verdict = acl && isValidIp(srcIp) && isValidIp(dstIp) ? evaluateAcl(acl, { srcIp, dstIp, protocol, dstPort: undefined }) : null

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Source" htmlFor="acl-src">
          <NativeSelect id="acl-src" value={srcId} onChange={(e) => setSrcId(e.target.value)}>
            <DeviceOptions state={network} filter={(d) => Boolean(d.host)} />
          </NativeSelect>
        </Field>
        <Field label="Destination" htmlFor="acl-dst">
          <NativeSelect id="acl-dst" value={dstId} onChange={(e) => setDstId(e.target.value)}>
            <DeviceOptions state={network} filter={(d) => Boolean(d.host)} />
          </NativeSelect>
        </Field>
        <Field label="Protocol" htmlFor="acl-proto">
          <NativeSelect id="acl-proto" value={protocol} onChange={(e) => setProtocol(e.target.value)}>
            <option value="icmp">ICMP</option>
            <option value="tcp">TCP</option>
            <option value="udp">UDP</option>
          </NativeSelect>
        </Field>
      </div>
      <div
        className={`rounded-lg border p-3 ${verdict?.action === 'permit' ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={verdict?.action === 'permit' ? 'success' : 'fail'}>{verdict ? verdict.action.toUpperCase() : 'N/A'}</StatusPill>
          <Mono>
            {srcIp || '—'} → {dstIp || '—'} ({protocol})
          </Mono>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-foreground/85">
          {!acl
            ? 'No ACL is configured on this network.'
            : !verdict
              ? 'Enter valid source and destination addresses.'
              : verdict.rule
                ? `Matched rule ${verdict.rule.seq}: ${verdict.rule.action} ${verdict.rule.protocol}${verdict.rule.remark ? ` — ${verdict.rule.remark}` : ''}.`
                : 'No rule matched, so the implicit “deny any” at the end of the ACL dropped the packet.'}
        </p>
      </div>
    </div>
  )
}

function SecurityPage() {
  const { network } = useNetwork()
  const configs = useMemo(() => generateConfigs(network), [network])
  const r1 = configs.find((c) => c.deviceId === 'R1')
  const r1Config = r1?.config ?? ''
  const acl = network.acls[0]
  const r1Device = getDevice(network, 'R1')
  const insideIfaces = (r1Device?.interfaces ?? []).filter((f) => f.nat === 'inside')
  const outsideIfaces = (r1Device?.interfaces ?? []).filter((f) => f.nat === 'outside')

  return (
    <div className="space-y-5">
      <Header slug="security" />

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel
          title="Wi-Fi access list (ACL)"
          description="An extended ACL applied inbound on the Wi-Fi subinterface. Every ACL ends with an implicit deny."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="p-2">Seq</th>
                  <th className="p-2">Action</th>
                  <th className="p-2">Proto</th>
                  <th className="p-2">Source</th>
                  <th className="p-2">Destination</th>
                  <th className="p-2">Remark</th>
                </tr>
              </thead>
              <tbody>
                {acl?.rules.map((rule) => (
                  <tr key={rule.id} className="border-b last:border-0">
                    <td className="p-2 font-mono text-xs">{rule.seq}</td>
                    <td className="p-2">
                      <StatusPill tone={rule.action === 'permit' ? 'success' : 'fail'}>{rule.action}</StatusPill>
                    </td>
                    <td className="p-2 font-mono text-xs uppercase">{rule.protocol}</td>
                    <td className="p-2 font-mono text-xs">{rule.srcPrefix === 0 ? 'any' : `${rule.src}/${rule.srcPrefix}`}</td>
                    <td className="p-2 font-mono text-xs">{rule.dstPrefix === 0 ? 'any' : `${rule.dst}/${rule.dstPrefix}`}</td>
                    <td className="p-2 text-xs text-muted-foreground">{rule.remark ?? '—'}</td>
                  </tr>
                ))}
                <tr>
                  <td className="p-2 font-mono text-xs text-muted-foreground">—</td>
                  <td className="p-2">
                    <StatusPill tone="fail">deny</StatusPill>
                  </td>
                  <td className="p-2 font-mono text-xs uppercase">ip</td>
                  <td className="p-2 font-mono text-xs">any</td>
                  <td className="p-2 font-mono text-xs">any</td>
                  <td className="p-2 text-xs text-muted-foreground">Implicit deny at the end of every ACL</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="ACL verdict simulator"
          description="Evaluate a packet against the live access list using the same engine that forwards traffic."
        >
          <AclTester />
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel
          title="NAT overload (PAT) at the edge"
          description="Private campus addresses share the single public address of the uplink interface."
        >
          <div className="flex items-stretch gap-3">
            <div className="flex-1 rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="text-xs font-semibold text-muted-foreground">Inside (private)</p>
              <ul className="mt-2 space-y-1">
                {insideIfaces.map((f) => (
                  <li key={f.name} className="font-mono text-[11px]">
                    <Mono>{f.name}</Mono> · {f.ip}/{f.prefix}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col items-center justify-center text-primary">
              <ArrowRight className="size-4" aria-hidden="true" />
              <span className="mt-1 rounded border border-primary/30 bg-accent px-1.5 py-0.5 text-[10px] font-medium text-primary">
                PAT
              </span>
            </div>
            <div className="flex-1 rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="text-xs font-semibold text-muted-foreground">Outside (public)</p>
              <ul className="mt-2 space-y-1">
                {outsideIfaces.map((f) => (
                  <li key={f.name} className="font-mono text-[11px]">
                    <Mono>{f.name}</Mono> · {f.ip}/{f.prefix}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Every private source is translated to the public uplink address, so the ISP only ever sees one campus address. Replies are
            translated back using the NAT table.
          </p>
          <div className="mt-3">
            <CodeBlock code={configSection(r1Config, 'NAT overload (PAT)')} label="NAT configuration" />
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Defense-in-depth checklist" description="Practical controls demonstrated in this project.">
            <ul className="space-y-3 text-sm">
              {[
                ['Least privilege between VLANs', 'The Wi-Fi ACL blocks students from reaching the Administrative Block.'],
                ['Edge NAT boundary', 'Private 10.10.0.0/16 addresses are hidden behind the public uplink.'],
                ['Segmented broadcast domains', 'Five VLANs limit the blast radius of broadcasts and loops.'],
                ['Reserved management addresses', 'DHCP exclusions keep the first ten addresses free for gateways and static devices.'],
                ['Encrypted management', 'SSH v2 replaces Telnet on the VTY lines.'],
              ].map(([title, detail]) => (
                <li key={title} className="flex gap-2.5">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                  <span>
                    <b className="font-medium">{title}.</b> <span className="text-muted-foreground">{detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Management hardening" description="Secure remote administration generated for R1.">
            <CodeBlock code={configSection(r1Config, 'Secure management (SSH v2)')} label="R1 hardening" />
          </Panel>
        </div>
      </div>
    </div>
  )
}

/* ── Documentation ────────────────────────────────────────────────────────── */

function DocumentationPage() {
  const { network } = useNetwork()
  const viva = [
    [
      'Why VLANs?',
      'They split one physical switch into separate broadcast domains, improving performance, organisation and policy control.',
    ],
    [
      'Why router-on-a-stick?',
      'One router trunk with 802.1Q subinterfaces provides a Layer 3 gateway for every VLAN without a router port per VLAN.',
    ],
    ['Why DHCP?', 'It automates address, mask, gateway and DNS delivery and avoids manual addressing mistakes.'],
    ['Why NAT?', 'Private RFC 1918 campus addresses are translated to the public uplink so the ISP can route return traffic.'],
    [
      'Why an ACL on Wi-Fi?',
      'Wireless clients are the least trusted segment, so they are denied access to the Administrative Block by default.',
    ],
    ['Why a default route?', 'R1 knows its own connected subnets; a default route 0.0.0.0/0 hands everything else to the ISP.'],
  ]
  return (
    <div className="space-y-5">
      <Header slug="documentation" />
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Viva quick answers" description="Short, exam-ready explanations for the core design decisions.">
          <div className="space-y-3 text-sm leading-relaxed">
            {viva.map(([q, a]) => (
              <p key={q}>
                <b>{q}</b> {a}
              </p>
            ))}
          </div>
        </Panel>
        <Panel title="Suggested test plan" description="Verification order for a working campus network.">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            {[
              'Verify all links and interface states (show ip interface brief).',
              'Confirm VLAN assignments and that trunks allow the required VLANs.',
              'Renew DHCP on one client from each client VLAN and check the lease.',
              'Ping same-subnet, then inter-VLAN destinations.',
              'Resolve campus DNS records from each department.',
              'Test the Wi-Fi ACL denial towards the Administrative Block.',
              'Confirm Internet reachability and NAT translation at the edge.',
            ].map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        </Panel>
      </div>

      <Panel title="Command reference" description="Every command used in the generated configuration, with its purpose.">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th className="p-2">Command</th>
                <th className="p-2">Meaning</th>
              </tr>
            </thead>
            <tbody>
              {COMMAND_EXPLANATIONS.map((c) => (
                <tr key={c.command} className="border-b last:border-0 align-top">
                  <td className="p-2">
                    <Mono>{c.command}</Mono>
                  </td>
                  <td className="p-2 text-muted-foreground">
                    {c.meaning}
                    {c.dependsOnModel ? <span className="mt-1 block text-xs italic">{c.dependsOnModel}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Packet Tracer build sequence" description="Reproduce the simulation in a real lab tool.">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            {[
              'Place R1 (2911), CORE-SW and the four access switches, then cable router-on-a-stick and the trunks.',
              'Create VLANs 10, 20, 30, 40 and 50 on each switch and assign access ports.',
              'Configure 802.1Q subinterfaces on R1 G0/0 with the gateway addresses.',
              'Add DHCP pools, exclusions, DNS records and the default route.',
              'Apply the Wi-Fi ACL on G0/0.50 and NAT overload on G0/1.',
              'Verify with ping, ipconfig, show ip route and show interfaces trunk.',
            ].map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        </Panel>
        <Panel title="Project at a glance" description="Live figures from the current configuration.">
          <KeyValue
            items={[
              ['Devices', String(network.devices.length)],
              ['Links', String(network.links.length)],
              ['VLANs', String(network.segments.length)],
              ['DHCP pools', String(network.dhcp.pools.length)],
              ['DNS records', String(network.dns.records.length)],
              ['ACLs', String(network.acls.length)],
            ]}
          />
        </Panel>
      </div>
    </div>
  )
}

/* ── About Project ────────────────────────────────────────────────────────── */

function AboutPage() {
  return (
    <div className="space-y-5">
      <Header slug="about" />
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Project scope" description="What this build covers.">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Smart Campus Network is an educational Computer Networks PBL simulation for a college campus. It combines topology design, IPv4
            subnetting, VLAN segmentation, inter-VLAN routing, DHCP, DNS, NAT, ACLs and structured troubleshooting in one inspectable
            interface.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {[
              'Five VLANs across four departments, a server room and campus Wi-Fi.',
              'Router-on-a-stick inter-VLAN routing with per-VLAN gateways.',
              'DHCP DORA with pools, exclusions and APIPA fallback.',
              'DNS zone with A records for the portal and library.',
              'NAT overload and a Wi-Fi extended ACL at the edge.',
              'A troubleshooting lab with nine verified fault scenarios.',
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </Panel>

        <div className="space-y-5">
          <Panel title="Simulation boundary" description="What is, and is not, real.">
            <Callout tone="warn" title="Educational simulation">
              This interface models protocol behaviour and configuration outcomes locally in the browser. It does not connect to or control
              Cisco Packet Tracer, physical switches, routers or external DNS servers.
            </Callout>
          </Panel>
          <Panel title="Technology" description="Built with a modern front-end stack.">
            <div className="flex flex-wrap gap-2">
              {['React 19', 'TypeScript', 'Vite 6', 'Tailwind CSS v4', 'shadcn/ui', 'Lucide React', 'React Router v7', 'Vitest'].map(
                (t) => (
                  <StatusPill key={t} tone="neutral">
                    {t}
                  </StatusPill>
                ),
              )}
            </div>
          </Panel>
          <Panel title="Learning outcomes" description="Skills demonstrated by the project.">
            <ul className="space-y-2 text-sm">
              {[
                ['Design', 'Plan an IPv4 address scheme and VLAN topology for a campus.'],
                ['Analyse', 'Trace a packet through Ethernet, ARP, routing, ACL and NAT decisions.'],
                ['Operate', 'Generate and read Cisco IOS configuration.'],
                ['Diagnose', 'Inject, reproduce and verify fixes for realistic faults.'],
              ].map(([k, v]) => (
                <li key={k} className="flex gap-3">
                  <span className="w-16 shrink-0 font-medium">{k}</span>
                  <span className="text-muted-foreground">{v}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
      <Panel title="Explore the project" description="Move from design to verification through the simulated network lifecycle.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {NAV_ITEMS.slice(1).map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className="group flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-accent/50"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                  <item.icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{item.label}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{item.summary}</span>
                </span>
              </span>
              <ArrowRight
                className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  )
}

/* ── Dispatch ─────────────────────────────────────────────────────────────── */

const PAGES = {
  topology: TopologyPage,
  addressing: AddressingPage,
  vlans: VlansPage,
  services: ServicesPage,
  'packet-flow': PacketFlowPage,
  connectivity: ConnectivityPage,
  models: ModelsPage,
  troubleshooting: TroubleshootingPage,
  security: SecurityPage,
  documentation: DocumentationPage,
  about: AboutPage,
}

export function SectionPage() {
  const { pathname } = useLocation()
  const slug = pathname.split('/').filter(Boolean)[0] ?? ''
  const Page = META[slug] ? PAGES[slug] : undefined
  if (!Page)
    return (
      <div className="space-y-4">
        <BackLink />
        <Callout tone="warn" title="Section not found">
          That project section does not exist.
        </Callout>
      </div>
    )
  return <Page />
}
