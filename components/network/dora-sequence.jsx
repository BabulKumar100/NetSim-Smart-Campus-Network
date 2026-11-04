import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, CircleSlash, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const ORDER = ['Discover', 'Offer', 'Request', 'Acknowledge']

const SHORT = { Discover: 'D', Offer: 'O', Request: 'R', Acknowledge: 'A' }

function stepTone(status) {
  if (status === 'ok') return { ring: 'border-success/40 bg-success/10 text-success', Icon: CheckCircle2 }
  if (status === 'fail') return { ring: 'border-destructive/40 bg-destructive/10 text-destructive', Icon: XCircle }
  return { ring: 'border-border bg-muted text-muted-foreground', Icon: CircleSlash }
}

/**
 * Animated DORA exchange: the four messages are revealed one after another so the
 * Discover → Offer → Request → Acknowledge sequence is easy to follow.
 */
export function DoraSequence({ steps }) {
  const [visible, setVisible] = useState(steps.length)

  useEffect(() => {
    if (steps.length === 0) return
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setVisible(steps.length)
      return
    }
    setVisible(0)
    let shown = 0
    const id = window.setInterval(() => {
      shown += 1
      setVisible(shown)
      if (shown >= steps.length) window.clearInterval(id)
    }, 480)
    return () => window.clearInterval(id)
  }, [steps])

  return (
    <div className="space-y-4">
      <ol className="flex flex-wrap items-center gap-1.5">
        {ORDER.map((name, i) => {
          const done = visible > i
          return (
            <li key={name} className="flex items-center gap-1.5">
              {i > 0 ? (
                <ArrowRight
                  className={cn('size-3.5 transition-colors', done ? 'text-primary' : 'text-muted-foreground/50')}
                  aria-hidden="true"
                />
              ) : null}
              <span
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all duration-300',
                  done ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/60 bg-muted/40 text-muted-foreground',
                )}
              >
                <span className="flex size-4 items-center justify-center rounded bg-background/70 font-mono text-[10px] font-bold">
                  {SHORT[name]}
                </span>
                <span className="hidden sm:inline">{name}</span>
              </span>
            </li>
          )
        })}
      </ol>

      <ol className="space-y-2">
        {steps.map((step, i) => {
          if (visible <= i) return null
          const { ring, Icon } = stepTone(step.status)
          return (
            <li key={`${step.name}-${i}`} className={cn('animate-fade-up rounded-lg border p-3', ring)}>
              <div className="flex flex-wrap items-center gap-2">
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="text-sm font-semibold">DHCP{step.name.toUpperCase()}</span>
                {step.from || step.to ? (
                  <span className="font-mono text-[11px] text-foreground/80">
                    {step.from || '—'} <ArrowRight className="inline size-3" aria-hidden="true" /> {step.to || '—'}
                  </span>
                ) : null}
                {step.ports ? (
                  <span className="rounded border border-border/60 bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {step.ports}
                  </span>
                ) : null}
              </div>
              {step.srcIp || step.srcMac ? (
                <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                  {step.srcIp && `src ${step.srcIp}`}
                  {step.srcMac && ` · ${step.srcMac}`}
                  {step.dstIp && ` → ${step.dstIp}`}
                  {step.dstMac && ` · ${step.dstMac}`}
                </p>
              ) : null}
              <p className="mt-1.5 text-xs leading-relaxed text-foreground/85">{step.detail}</p>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
