import { Link } from 'react-router-dom'
import { ArrowRight, Bug, CheckCircle2, CircleAlert, Gauge, Network, Play, ShieldCheck, Workflow } from 'lucide-react'
import { useNetwork } from '@/lib/network/store'
import { validateNetwork } from '@/lib/network/state'
import { testConnectivity } from '@/lib/network/engine'
import { NAV_ITEMS } from '@/lib/nav'
import { Callout, Panel, SimulatedBadge, StatusPill } from '@/components/network/primitives'
import { TopologyCanvas, useDeviceStatus } from '@/components/network/topology-canvas'
import { HealthBar, StatCard } from '@/components/dashboard/stat-card'

const KIND_LABEL = { ping: 'Connectivity', dns: 'DNS', dhcp: 'DHCP', flow: 'Packet flow', lab: 'Lab' }

function RecentActivity() {
  const { history, clearHistory } = useNetwork()
  const recent = [...history].slice(-6).reverse()
  return (
    <Panel
      title="Recent simulation activity"
      description="Every simulated test is recorded in this browser."
      actions={
        history.length ? (
          <button type="button" onClick={clearHistory} className="text-xs font-medium text-muted-foreground hover:text-foreground">
            Clear
          </button>
        ) : undefined
      }
    >
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No tests yet. Run a connectivity test, a DHCP exchange or a troubleshooting scenario and it will appear here.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {recent.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-2.5 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{r.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {KIND_LABEL[r.kind] ?? r.kind} · {new Date(r.at).toLocaleTimeString()}
                </p>
              </div>
              <StatusPill tone={r.success ? 'success' : 'fail'}>{r.success ? 'PASS' : 'FAIL'}</StatusPill>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function NetworkHealth() {
  const { network } = useNetwork()
  const status = useDeviceStatus(network)
  const counts = { ok: 0, degraded: 0, fail: 0, off: 0 }
  for (const value of status.values()) counts[value] += 1
  const total = network.devices.length
  const rows = [
    { label: 'Healthy', value: counts.ok, dot: 'bg-success', text: 'text-success' },
    { label: 'Degraded', value: counts.degraded, dot: 'bg-warning', text: 'text-warning-foreground' },
    { label: 'Failed', value: counts.fail, dot: 'bg-destructive', text: 'text-destructive' },
    { label: 'Offline', value: counts.off, dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
  ]
  const healthy = total === 0 ? 0 : Math.round((counts.ok / total) * 100)
  return (
    <Panel title="Network health" description={`${healthy}% of devices report a reachable default gateway or healthy link state.`}>
      <HealthBar segments={rows.map((r) => ({ label: r.label, value: r.value, className: r.dot }))} />
      <ul className="mt-4 space-y-1.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className={`size-2 rounded-full ${r.dot}`} aria-hidden="true" />
              {r.label}
            </span>
            <span className={`font-mono text-xs tabular-nums ${r.text}`}>{r.value}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

export function Dashboard() {
  const { network } = useNetwork()
  const issues = validateNetwork(network)
  const errors = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')
  const activeLinks = network.links.filter((l) => l.up).length
  const online = network.devices.filter((d) => d.online).length
  const result = testConnectivity(network, { sourceId: 'CSE-PC1', destination: { deviceId: 'SRV-CORE' } })

  return (
    <div className="space-y-6">
      <section className="sheen relative overflow-hidden rounded-2xl border bg-card p-5 sm:p-7">
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
              <span className="size-1.5 animate-pulse rounded-full bg-success" aria-hidden="true" />
              Network operations console <span className="text-muted-foreground">/</span> campus-lab-01
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Network Overview</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">
              Monitor, simulate and troubleshoot a five-VLAN college campus network. Every result is deterministic and clearly labelled as
              educational simulation data.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <SimulatedBadge />
              <StatusPill tone="success">
                <ShieldCheck className="size-3" aria-hidden="true" /> Configuration loaded
              </StatusPill>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/topology"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              <Network className="size-4" aria-hidden="true" /> Open topology
            </Link>
            <Link
              to="/connectivity"
              className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3.5 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              <Play className="size-4" aria-hidden="true" /> Run a test
            </Link>
            <Link
              to="/troubleshooting"
              className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3.5 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              <Bug className="size-4" aria-hidden="true" /> Troubleshoot
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total devices"
          value={network.devices.length}
          hint={`${online} online in the model`}
          icon={Network}
          tone="info"
          delay={0}
        />
        <StatCard
          label="Network links"
          value={activeLinks}
          hint={`${network.links.length} links · ${activeLinks} active`}
          icon={Workflow}
          tone="info"
          delay={80}
        />
        <StatCard
          label="Configuration errors"
          value={errors.length}
          hint={errors.length ? `${warnings.length} warning(s)` : 'Healthy configuration'}
          icon={errors.length ? CircleAlert : CheckCircle2}
          tone={errors.length ? 'fail' : 'success'}
          delay={160}
        />
        <StatCard
          label="Connectivity test"
          text={result.success ? 'PASS' : 'FAIL'}
          hint="CSE-PC1 → SRV-CORE"
          icon={Gauge}
          tone={result.success ? 'success' : 'fail'}
          delay={240}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <Panel
          title="Campus topology"
          description={`${network.devices.length} devices across five VLANs. Drag to pan, Ctrl + scroll to zoom, select a node to inspect it.`}
          actions={
            <Link to="/topology" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              Open full view <ArrowRight className="size-3" aria-hidden="true" />
            </Link>
          }
        >
          <TopologyCanvas state={network} className="h-[440px]" compact />
        </Panel>
        <div className="space-y-6">
          <NetworkHealth />
          <RecentActivity />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Panel title="Reference connectivity" description="A baseline inter-VLAN test from CSE-PC1 to SRV-CORE.">
          <div className="rounded-lg border bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs">
                {result.sourceIp} → {result.destinationIp}
              </span>
              <StatusPill tone={result.success ? 'success' : 'fail'}>{result.success ? 'PASS' : 'FAIL'}</StatusPill>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{result.summary}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Path: <span className="font-mono">{result.forward.path.join(' → ') || '—'}</span>
            </p>
          </div>
          <Link to="/packet-flow" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            Trace this packet step by step <ArrowRight className="size-3" aria-hidden="true" />
          </Link>
        </Panel>

        <Panel title="Validation status" description="Subnet alignment, gateways, VLANs, DHCP pools, DNS records and duplicate addresses.">
          {issues.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="size-4" aria-hidden="true" /> No configuration issues detected in the default plan.
            </div>
          ) : (
            <div className="space-y-2">
              {issues.slice(0, 4).map((issue) => (
                <div key={`${issue.subject}-${issue.message}`} className="flex gap-2 text-sm">
                  <CircleAlert
                    className={`mt-0.5 size-4 shrink-0 ${issue.severity === 'error' ? 'text-destructive' : 'text-warning-foreground'}`}
                    aria-hidden="true"
                  />
                  <span>
                    <b>{issue.subject}:</b> {issue.message}
                  </span>
                </div>
              ))}
              {issues.length > 4 ? (
                <Callout tone="info">
                  {issues.length - 4} more issue(s) — open the addressing or troubleshooting section for the full audit.
                </Callout>
              ) : null}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Explore the project" description="Move from design to verification through the simulated network lifecycle.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {NAV_ITEMS.slice(1, 10).map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className="group flex min-w-0 items-center justify-between rounded-lg border border-border/60 px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-accent/50"
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
