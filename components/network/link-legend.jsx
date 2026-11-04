import { cn } from '@/lib/utils'

/** Single source of truth for the link colours used by the topology canvas. */
export const LINK_LEGEND = [
  { label: 'Trunk', description: '802.1Q tagged uplink carrying several VLANs', stroke: 'var(--primary)', width: 3 },
  { label: 'Access', description: 'Untagged link to a single-VLAN end device', stroke: 'var(--muted-foreground)', width: 2.5 },
  { label: 'Wireless', description: '802.11 association between AP and client', stroke: 'var(--info)', width: 1.75, dash: '5 5' },
  { label: 'Active packet', description: 'Links on the packet path being traced', stroke: 'var(--success)', width: 3.5, dash: '3 7' },
  { label: 'Down / failed', description: 'Cable or interface administratively down', stroke: 'var(--destructive)', width: 2, dash: '4 4' },
]

export function LinkLegend({ className, cols = 3 }) {
  return (
    <div className={cn('grid gap-2', cols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2', className)}>
      {LINK_LEGEND.map((item) => (
        <div key={item.label} className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2">
          <svg width={40} height={12} viewBox="0 0 40 12" aria-hidden="true" className="shrink-0">
            <line
              x1={2}
              y1={6}
              x2={38}
              y2={6}
              stroke={item.stroke}
              strokeWidth={item.width ?? 2}
              strokeDasharray={item.dash}
              strokeLinecap="round"
            />
          </svg>
          <div className="min-w-0">
            <p className="text-xs font-medium">{item.label}</p>
            <p className="text-[11px] leading-snug text-muted-foreground">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
