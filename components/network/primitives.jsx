import { useState } from 'react'
import { Check, Copy, FlaskConical, Info, TriangleAlert, CircleX, CircleCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

export function SectionHeader({ title, description, children }) {
  return (
    <header className="flex flex-col gap-3 border-b pb-5 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  )
}

export function Panel({ title, description, actions, children, className }) {
  return (
    <section className={cn('rounded-lg border bg-card', className)}>
      {title ? (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            {description ? <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  )
}

export function SimulatedBadge({ label = 'Simulated' }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
      <FlaskConical className="size-3" aria-hidden="true" />
      {label}
    </span>
  )
}

export function StatusPill({ tone, children }) {
  const styles = {
    success: 'bg-success/10 text-success border-success/25',
    fail: 'bg-destructive/10 text-destructive border-destructive/25',
    warn: 'bg-warning/15 text-warning-foreground border-warning/30',
    neutral: 'bg-muted text-muted-foreground border-border',
    info: 'bg-accent text-accent-foreground border-primary/20',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium', styles[tone])}>{children}</span>
  )
}

export function Callout({ tone = 'info', title, children }) {
  const map = {
    info: { cls: 'border-primary/20 bg-accent/60', Icon: Info, icon: 'text-primary' },
    warn: { cls: 'border-warning/40 bg-warning/10', Icon: TriangleAlert, icon: 'text-warning-foreground' },
    success: { cls: 'border-success/30 bg-success/5', Icon: CircleCheck, icon: 'text-success' },
    fail: { cls: 'border-destructive/30 bg-destructive/5', Icon: CircleX, icon: 'text-destructive' },
  }[tone]
  return (
    <div className={cn('flex gap-3 rounded-lg border p-3 text-sm', map.cls)} role={tone === 'fail' ? 'alert' : undefined}>
      <map.Icon className={cn('mt-0.5 size-4 shrink-0', map.icon)} aria-hidden="true" />
      <div className="min-w-0 leading-relaxed">
        {title ? <p className="font-medium">{title}</p> : null}
        <div className={cn(title && 'mt-0.5', 'text-foreground/85')}>{children}</div>
      </div>
    </div>
  )
}

export function NativeSelect({ className, children, ...props }) {
  return (
    <select
      className={cn(
        'h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export function Field({ label, htmlFor, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-foreground/80">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

const ZONE_LABEL = {
  cse: 'CSE (VLAN 10)',
  admin: 'Administration (VLAN 20)',
  library: 'Library (VLAN 30)',
  servers: 'Server Room (VLAN 40)',
  wifi: 'Campus Wi-Fi (VLAN 50)',
  core: 'Core',
  external: 'External / Internet',
}

export function DeviceOptions({ state, filter }) {
  const zones = Object.keys(ZONE_LABEL)
  return (
    <>
      {zones.map((z) => {
        const devs = state.devices.filter((d) => d.zone === z && filter(d))
        if (devs.length === 0) return null
        return (
          <optgroup key={z} label={ZONE_LABEL[z]}>
            {devs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.host?.ip ? ` — ${d.host.ip}` : ''}
              </option>
            ))}
          </optgroup>
        )
      })}
    </>
  )
}

export function CodeBlock({ code, label, className }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className={cn('overflow-hidden rounded-lg border bg-[oklch(0.22_0.03_260)] text-[oklch(0.93_0.01_250)]', className)}>
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className="font-mono text-xs text-white/60">{label ?? 'text'}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(code).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            })
          }}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white/50"
        >
          {copied ? <Check className="size-3" aria-hidden="true" /> : <Copy className="size-3" aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="max-h-[28rem] overflow-auto p-3 font-mono text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function KeyValue({ items }) {
  return (
    <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-1.5 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 font-medium break-words">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Mono({ children }) {
  return <span className="font-mono text-[0.85em]">{children}</span>
}
