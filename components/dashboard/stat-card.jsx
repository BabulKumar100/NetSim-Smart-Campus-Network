import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { StatusPill } from '@/components/network/primitives'

function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(() => target)

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || !Number.isFinite(target)) {
      setValue(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}

export function StatCard({ label, value, text, icon: Icon, tone, hint, delay = 0 }) {
  const animated = useCountUp(value ?? 0)
  const display = text ?? String(animated)
  return (
    <div
      className="animate-fade-up group relative overflow-hidden rounded-xl border bg-card p-4 transition-shadow hover:shadow-[0_10px_30px_-18px_color-mix(in_oklab,var(--primary)_70%,transparent)]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-10 size-24 rounded-full bg-primary/5 blur-2xl transition-opacity group-hover:opacity-100"
        aria-hidden="true"
      />
      <div className="relative flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{display}</p>
          {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <StatusPill tone={tone}>
          <Icon className="size-3.5" aria-hidden="true" />
        </StatusPill>
      </div>
    </div>
  )
}

/** Compact proportional bar used for the network health breakdown. */
export function HealthBar({ segments }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
      {segments.map((s) => (
        <div
          key={s.label}
          className={cn('h-full transition-[width] duration-700', s.className)}
          style={{ width: `${(s.value / total) * 100}%` }}
          title={`${s.label}: ${s.value}`}
        />
      ))}
    </div>
  )
}
