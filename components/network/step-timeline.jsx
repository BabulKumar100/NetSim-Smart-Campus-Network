import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const LAYER_META = {
  L7: { name: 'Application', tint: 'text-success' },
  L4: { name: 'Transport', tint: 'text-violet' },
  L3: { name: 'Network', tint: 'text-primary' },
  L2: { name: 'Data Link', tint: 'text-info' },
  L1: { name: 'Physical', tint: 'text-muted-foreground' },
}

function statusDot(status) {
  switch (status) {
    case 'ok':
      return 'bg-success'
    case 'fail':
      return 'bg-destructive'
    case 'warn':
      return 'bg-warning'
    default:
      return 'bg-primary'
  }
}

function FrameDetails({ frame }) {
  const rows = []
  if (frame.srcMac || frame.dstMac) rows.push(['MAC', `${frame.srcMac ?? '—'} → ${frame.dstMac ?? '—'}`])
  rows.push(['IP', `${frame.srcIp} → ${frame.dstIp}`])
  if (frame.vlan) rows.push(['VLAN', `tagged ${frame.vlan}`])
  rows.push([
    frame.protocol.toUpperCase(),
    [frame.srcPort && `sport ${frame.srcPort}`, frame.dstPort && `dport ${frame.dstPort}`, `TTL ${frame.ttl}`].filter(Boolean).join(' · '),
  ])
  return (
    <dl className="mt-2 grid grid-cols-[minmax(3.5rem,auto)_1fr] gap-x-3 gap-y-1 rounded-md border border-border/60 bg-muted/40 p-2 font-mono text-[11px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="break-all text-foreground/90">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Vertical, layer-tagged timeline of packet-forwarding decisions produced by the engine. */
export function StepTimeline({ steps, className }) {
  return (
    <ol className={cn('relative space-y-3', className)}>
      {steps.map((step, i) => {
        const meta = LAYER_META[step.layer]
        return (
          <li key={`${step.title}-${i}`} className="relative flex gap-3 pl-1">
            <div className="flex flex-col items-center">
              <span
                className={cn('mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-background', statusDot(step.status))}
                aria-hidden="true"
              />
              {i < steps.length - 1 ? <span className="mt-1 w-px flex-1 bg-border" aria-hidden="true" /> : null}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn('rounded border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold', meta.tint)}
                  title={`${step.layer} ${meta.name}`}
                >
                  {step.layer}
                </span>
                <span className="text-sm font-medium">{step.title}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.detail}</p>
              {step.frame ? <FrameDetails frame={step.frame} /> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** Horizontal "source → path" ribbon used above a trace result. */
export function PathRibbon({ path, className }) {
  if (path.length === 0) return null
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5 font-mono text-xs', className)}>
      {path.map((node, i) => (
        <span key={`${node}-${i}`} className="flex items-center gap-1.5">
          {i > 0 ? <ArrowRight className="size-3 text-muted-foreground" aria-hidden="true" /> : null}
          <span className="rounded border border-border/60 bg-card px-1.5 py-0.5">{node}</span>
        </span>
      ))}
    </div>
  )
}
