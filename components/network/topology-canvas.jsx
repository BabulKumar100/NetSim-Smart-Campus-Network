import { useMemo, useRef, useState } from 'react'
import { Globe, Laptop, Maximize2, Minus, Monitor, Network, Plus, Router, Server, Smartphone, Wifi } from 'lucide-react'
import { cn } from '@/lib/utils'
import { gatewayReachable } from '@/lib/network/engine'
import { deviceVlanLabel, polylineKeyPoints, polylinePath, tracePoints } from '@/lib/visual'

export const VIEW_W = 1000
export const VIEW_H = 540

const REGIONS = [
  { id: 'external', label: 'External network (simulated ISP)', x: 30, y: 18, w: 300, h: 104 },
  { id: 'servers', label: 'Server Room · VLAN 40', x: 700, y: 88, w: 270, h: 104 },
  { id: 'cse', label: 'CSE Department · VLAN 10', x: 30, y: 280, w: 250, h: 232 },
  { id: 'admin', label: 'Administrative Block · VLAN 20', x: 292, y: 280, w: 206, h: 232 },
  { id: 'library', label: 'College Library · VLAN 30', x: 510, y: 280, w: 194, h: 232 },
  { id: 'wifi', label: 'Campus Wi-Fi · VLAN 50', x: 728, y: 280, w: 242, h: 232 },
]

/** Accent hue per zone, used for VLAN background washes and zone labels. */
const REGION_TINT = {
  external: 'var(--muted-foreground)',
  servers: 'var(--violet)',
  cse: 'var(--primary)',
  admin: 'var(--info)',
  library: 'var(--success)',
  wifi: 'var(--warning)',
}

export function DeviceGlyph({ device, className, size }) {
  const props = { className, 'aria-hidden': true, ...(size ? { width: size, height: size } : {}) }
  switch (device.type) {
    case 'router':
      return <Router {...props} />
    case 'switch':
      return <Network {...props} />
    case 'server':
      return device.zone === 'external' ? <Globe {...props} /> : <Server {...props} />
    case 'pc':
      return <Monitor {...props} />
    case 'ap':
      return <Wifi {...props} />
    case 'wireless':
      return device.model.startsWith('Smartphone') ? <Smartphone {...props} /> : <Laptop {...props} />
  }
}

export function useDeviceStatus(state) {
  return useMemo(() => {
    const map = new Map()
    for (const d of state.devices) {
      if (!d.online) {
        map.set(d.id, 'off')
        continue
      }
      if (d.host) {
        if (d.zone === 'external') map.set(d.id, d.host.gateway ? (gatewayReachable(state, d.id) ? 'ok' : 'fail') : 'ok')
        else map.set(d.id, gatewayReachable(state, d.id) ? 'ok' : 'fail')
        continue
      }
      const links = state.links.filter((l) => l.a.device === d.id || l.b.device === d.id)
      const ifDown = d.interfaces?.some((f) => !f.up)
      map.set(d.id, links.some((l) => !l.up) || ifDown ? 'degraded' : 'ok')
    }
    return map
  }, [state])
}

const STATUS_FILL = {
  ok: 'var(--success)',
  fail: 'var(--destructive)',
  off: 'var(--muted-foreground)',
  degraded: 'var(--warning)',
}

const STATUS_TEXT = { ok: 'Operational', fail: 'Unreachable', off: 'Powered off', degraded: 'Degraded' }

/** Colour-codes a link by its role: trunk, access, wireless, down or actively traced. */
function linkStroke(link, highlighted, tracing) {
  if (tracing) return { stroke: 'var(--success)', width: 3.5, dash: '3 7', opacity: 1 }
  if (highlighted) return { stroke: 'var(--primary)', width: 3.5, dash: link.mode === 'wireless' ? '6 5' : undefined, opacity: 1 }
  if (!link.up) return { stroke: 'var(--destructive)', width: 2, dash: '4 4', opacity: 1 }
  switch (link.mode) {
    case 'trunk':
      return { stroke: 'var(--primary)', width: 3, dash: undefined, opacity: 0.7 }
    case 'wireless':
      return { stroke: 'var(--info)', width: 1.75, dash: '5 5', opacity: 0.9 }
    case 'direct':
      return { stroke: 'var(--muted-foreground)', width: 2.5, dash: undefined, opacity: 0.75 }
    default:
      return { stroke: 'var(--muted-foreground)', width: 1.75, dash: undefined, opacity: 0.6 }
  }
}

export function TopologyCanvas({
  state,
  selectedId,
  onSelect,
  highlightPath,
  activeNode,
  packetFailed,
  className,
  showStatus = true,
  compact,
  ambient = true,
  replayKey = 0,
}) {
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const [hoverId, setHoverId] = useState(null)
  const drag = useRef(null)
  const svgRef = useRef(null)
  const status = useDeviceStatus(state)
  const byId = useMemo(() => new Map(state.devices.map((d) => [d.id, d])), [state.devices])
  const tracing = Boolean(highlightPath && highlightPath.length > 1)

  const highlightedLinks = useMemo(() => {
    const set = new Set()
    if (!highlightPath) return set
    for (let i = 0; i < highlightPath.length - 1; i++) {
      const a = highlightPath[i]
      const b = highlightPath[i + 1]
      const l = state.links.find((x) => (x.a.device === a && x.b.device === b) || (x.a.device === b && x.b.device === a))
      if (l) set.add(l.id)
    }
    return set
  }, [highlightPath, state.links])

  /** Ordered node pairs along the traced path, used for the moving packet animation. */
  const traceSegments = useMemo(() => {
    if (!highlightPath || highlightPath.length < 2) return []
    const segments = []
    for (let i = 0; i < highlightPath.length - 1; i++) {
      const a = byId.get(highlightPath[i])
      const b = byId.get(highlightPath[i + 1])
      if (a && b) segments.push({ from: a.id, to: b.id, x1: a.x, y1: a.y, x2: b.x, y2: b.y })
    }
    return segments
  }, [highlightPath, byId])

  /** Undirected set of the traced node pairs, computed once per path change. */
  const tracedPairSet = useMemo(() => {
    const set = new Set()
    for (const s of traceSegments) {
      set.add(`${s.from}|${s.to}`)
      set.add(`${s.to}|${s.from}`)
    }
    return set
  }, [traceSegments])

  const traceMotion = useMemo(() => {
    const pts = tracePoints(state.devices, highlightPath ?? [])
    if (pts.length < 2) return null
    const keyPoints = polylineKeyPoints(pts)
    const keyTimes = pts.map((_, i) => Number((i / (pts.length - 1)).toFixed(4)))
    return {
      path: polylinePath(pts),
      keyPoints: keyPoints.join(';'),
      keyTimes: keyTimes.join(';'),
      dur: `${Math.max(1.8, (pts.length - 1) * 0.6).toFixed(1)}s`,
    }
  }, [highlightPath, state.devices])

  const toSvgScale = () => {
    const rect = svgRef.current?.getBoundingClientRect()
    return rect ? VIEW_W / rect.width : 1
  }

  const zoomBy = (factor, cx = VIEW_W / 2, cy = VIEW_H / 2) => {
    setView((v) => {
      const k = Math.min(3, Math.max(0.6, v.k * factor))
      const ratio = k / v.k
      return { k, x: cx - (cx - v.x) * ratio, y: cy - (cy - v.y) * ratio }
    })
  }

  const onWheel = (e) => {
    if (!e.ctrlKey && !e.metaKey && !e.altKey) return
    e.preventDefault()
    const rect = svgRef.current.getBoundingClientRect()
    const s = toSvgScale()
    zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, (e.clientX - rect.left) * s, (e.clientY - rect.top) * s)
  }

  const onPointerDown = (e) => {
    drag.current = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y, moved: false }
  }
  const onPointerMove = (e) => {
    const d = drag.current
    if (!d) return
    const s = toSvgScale()
    const dx = (e.clientX - d.px) * s
    const dy = (e.clientY - d.py) * s
    if (!d.moved && Math.hypot(dx, dy) > 4) {
      d.moved = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    if (d.moved) setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }))
  }
  const onPointerUp = (e) => {
    const d = drag.current
    drag.current = null
    if (d && !d.moved && e.target === e.currentTarget) onSelect?.(null)
  }

  const hovered = hoverId ? byId.get(hoverId) : undefined

  return (
    <div className={cn('relative overflow-hidden rounded-xl border bg-card', className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="block h-full w-full touch-none select-none"
        role="group"
        aria-label="Campus network topology diagram"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          drag.current = null
          setHoverId(null)
        }}
        style={{ cursor: drag.current?.moved ? 'grabbing' : 'grab' }}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {REGIONS.map((r) => {
            const tint = REGION_TINT[r.id] ?? 'var(--primary)'
            return (
              <g key={r.id} pointerEvents="none">
                <rect
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                  rx={12}
                  fill={`color-mix(in oklab, ${tint} 9%, var(--card))`}
                  stroke={`color-mix(in oklab, ${tint} 26%, var(--border))`}
                />
                <text x={r.x + 12} y={r.y + 18} fontSize={11} fontWeight={600} fill={`color-mix(in oklab, ${tint} 65%, var(--foreground))`}>
                  {r.label}
                </text>
              </g>
            )
          })}
          <text x={592} y={44} fontSize={11} fontWeight={600} fill="var(--muted-foreground)" pointerEvents="none">
            Core / distribution
          </text>

          {state.links.map((l) => {
            const a = byId.get(l.a.device)
            const b = byId.get(l.b.device)
            if (!a || !b) return null
            const traced = tracedPairSet.has(`${l.a.device}|${l.b.device}`)
            const st = linkStroke(l, highlightedLinks.has(l.id), tracing && traced)
            return (
              <g key={l.id} pointerEvents="none">
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={st.stroke}
                  strokeWidth={st.width}
                  strokeDasharray={st.dash}
                  strokeLinecap="round"
                  opacity={st.opacity}
                  className={st.dash && (highlightedLinks.has(l.id) || traced) ? 'animate-dash-flow' : undefined}
                />
                {!l.up ? (
                  <text
                    x={(a.x + b.x) / 2}
                    y={(a.y + b.y) / 2 + 4}
                    textAnchor="middle"
                    fontSize={14}
                    fontWeight={700}
                    fill="var(--destructive)"
                  >
                    ×
                  </text>
                ) : null}
              </g>
            )
          })}

          {ambient && !tracing
            ? state.links.map((l, i) => {
                const a = byId.get(l.a.device)
                const b = byId.get(l.b.device)
                if (!a || !b || !l.up || !a.online || !b.online) return null
                return (
                  <circle
                    key={`amb-${l.id}`}
                    r={2.2}
                    fill={l.mode === 'wireless' ? 'var(--info)' : 'var(--primary)'}
                    opacity={0.75}
                    pointerEvents="none"
                  >
                    <animateMotion
                      dur={`${(2.6 + (i % 5) * 0.45).toFixed(2)}s`}
                      begin={`${((i * 0.37) % 2).toFixed(2)}s`}
                      repeatCount="indefinite"
                      path={`M ${b.x} ${b.y} L ${a.x} ${a.y}`}
                    />
                  </circle>
                )
              })
            : null}

          {traceMotion ? (
            <g key={`trace-${replayKey}-${traceMotion.path}`} pointerEvents="none">
              {[
                { r: 11, o: 0.22 },
                { r: 5.5, o: 1 },
              ].map((c) => (
                <circle
                  key={c.r}
                  r={c.r}
                  fill={packetFailed ? 'var(--destructive)' : 'var(--success)'}
                  opacity={c.o}
                  stroke={c.o === 1 ? 'var(--card)' : undefined}
                  strokeWidth={c.o === 1 ? 1.5 : undefined}
                >
                  <animateMotion
                    dur={traceMotion.dur}
                    repeatCount="indefinite"
                    path={traceMotion.path}
                    keyPoints={traceMotion.keyPoints}
                    keyTimes={traceMotion.keyTimes}
                    calcMode="linear"
                  />
                </circle>
              ))}
            </g>
          ) : null}

          {state.devices.map((d) => {
            const selected = selectedId === d.id
            const onPath = highlightPath?.includes(d.id)
            const active = activeNode === d.id
            const st = status.get(d.id) ?? 'off'
            return (
              <g
                key={d.id}
                transform={`translate(${d.x} ${d.y})`}
                role="button"
                tabIndex={onSelect ? 0 : -1}
                aria-label={`${d.name}, ${d.model}${d.host?.ip ? `, ${d.host.ip}` : ''}`}
                aria-pressed={selected}
                onPointerEnter={() => setHoverId(d.id)}
                onPointerLeave={() => setHoverId((id) => (id === d.id ? null : id))}
                onPointerUp={(e) => {
                  e.stopPropagation()
                  if (!drag.current?.moved) onSelect?.(d.id)
                  drag.current = null
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect?.(d.id)
                  }
                }}
                className={cn(onSelect && 'cursor-pointer', 'outline-none [&:focus-visible>circle:first-child]:stroke-ring')}
                opacity={d.online ? 1 : 0.5}
              >
                {active ? (
                  <circle r={33} fill="none" stroke={packetFailed ? 'var(--destructive)' : 'var(--primary)'} strokeWidth={3}>
                    <animate attributeName="r" values="27;35;27" dur="1.2s" repeatCount="indefinite" />
                  </circle>
                ) : null}
                {st === 'fail' && d.online ? (
                  <circle r={28} fill="none" stroke="var(--destructive)" strokeWidth={2}>
                    <animate attributeName="r" values="25;36;25" dur="1.6s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.9;0;0.9" dur="1.6s" repeatCount="indefinite" />
                  </circle>
                ) : null}
                {selected ? (
                  <circle r={31} fill="none" stroke="var(--primary)" strokeWidth={1.5} opacity={0.5} className="animate-pulse-ring" />
                ) : null}
                <circle
                  r={24}
                  fill={selected || onPath ? 'var(--accent)' : 'var(--card)'}
                  stroke={selected || onPath ? 'var(--primary)' : 'color-mix(in oklab, var(--foreground) 24%, transparent)'}
                  strokeWidth={selected ? 3 : onPath ? 2.25 : 1.5}
                />
                <g transform="translate(-12 -12)" color={selected || onPath ? 'var(--primary)' : 'var(--foreground)'}>
                  <DeviceGlyph device={d} size={24} />
                </g>
                {showStatus ? (
                  <circle cx={17} cy={-17} r={5.5} fill={STATUS_FILL[st]} stroke="var(--card)" strokeWidth={2}>
                    <title>{statusLabel(st, d)}</title>
                  </circle>
                ) : null}
                <text y={39} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="var(--foreground)">
                  {d.id}
                </text>
                {!compact && d.host?.ip ? (
                  <text y={52} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)" fontFamily="var(--font-mono)">
                    {d.host.ip}
                  </text>
                ) : null}
              </g>
            )
          })}

          {hovered ? (
            <g
              pointerEvents="none"
              transform={`translate(${Math.min(Math.max(hovered.x + 30, 8), VIEW_W - 222)} ${Math.max(hovered.y - 100, 8)})`}
            >
              <rect width={214} height={92} rx={10} fill="var(--popover)" stroke="color-mix(in oklab, var(--primary) 35%, var(--border))" />
              <circle cx={198} cy={18} r={4.5} fill={STATUS_FILL[status.get(hovered.id) ?? 'off']} />
              <text x={12} y={21} fontSize={12} fontWeight={700} fill="var(--popover-foreground)">
                {hovered.name}
              </text>
              <text x={12} y={37} fontSize={10} fill="var(--muted-foreground)">
                {hovered.model} · {hovered.type}
              </text>
              <text x={12} y={53} fontSize={10} fontFamily="var(--font-mono)" fill="var(--popover-foreground)">
                {hovered.host?.ip ||
                  hovered.interfaces
                    ?.map((i) => i.ip)
                    .slice(0, 2)
                    .join(', ') ||
                  'Layer 2 only'}
              </text>
              <text x={12} y={69} fontSize={10} fill="var(--primary)">
                {deviceVlanLabel(state, hovered)}
              </text>
              <text x={12} y={84} fontSize={10} fill={STATUS_FILL[status.get(hovered.id) ?? 'off']}>
                {STATUS_TEXT[status.get(hovered.id) ?? 'off']}
              </text>
            </g>
          ) : null}
        </g>
      </svg>
      <div className="absolute right-2 top-2 flex flex-col overflow-hidden rounded-lg border bg-card shadow-lg">
        <button
          type="button"
          onClick={() => zoomBy(1.2)}
          className="p-1.5 transition-colors hover:bg-muted focus-visible:bg-muted"
          aria-label="Zoom in"
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.2)}
          className="border-t p-1.5 transition-colors hover:bg-muted focus-visible:bg-muted"
          aria-label="Zoom out"
        >
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setView({ x: 0, y: 0, k: 1 })}
          className="border-t p-1.5 transition-colors hover:bg-muted focus-visible:bg-muted"
          aria-label="Reset view"
        >
          <Maximize2 className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

export function statusLabel(st, d) {
  if (st === 'off') return 'Powered off in the model'
  if (d.host) return st === 'ok' ? 'Simulated ping to default gateway succeeds' : 'Simulated ping to default gateway fails'
  return st === 'ok' ? 'Powered on; all links and interfaces up in the model' : 'Powered on; at least one link or interface is down'
}
