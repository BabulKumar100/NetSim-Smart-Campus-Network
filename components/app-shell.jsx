import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Activity, Loader2, Menu, Moon, PanelLeftClose, PanelLeftOpen, RotateCcw, Sun, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from '@/lib/nav'
import { useNetwork } from '@/lib/network/store'
import { validateNetwork } from '@/lib/network/state'
import { useTheme } from '@/lib/theme'
import { StatusPill } from '@/components/network/primitives'

const GROUPS = [
  { label: 'Monitor', hrefs: ['/', '/topology', '/connectivity'] },
  { label: 'Design', hrefs: ['/addressing', '/vlans', '/services', '/packet-flow', '/models'] },
  { label: 'Learn', hrefs: ['/troubleshooting', '/security', '/documentation', '/about'] },
]

function isActive(href, pathname) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

function NavList({ collapsed = false, onNavigate }) {
  const { pathname } = useLocation()
  const indexOf = (href) => NAV_ITEMS.findIndex((n) => n.href === href) + 1
  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2" aria-label="Sections">
      {GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          {!collapsed ? (
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/45">{group.label}</p>
          ) : (
            <div className="mx-auto my-1 h-px w-6 bg-sidebar-border" aria-hidden="true" />
          )}
          {group.hrefs.map((href) => {
            const item = NAV_ITEMS.find((n) => n.href === href)
            if (!item) return null
            const active = isActive(item.href, pathname)
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                aria-current={active ? 'page' : undefined}
                style={active ? { boxShadow: '0 8px 22px -12px color-mix(in oklab, var(--sidebar-primary) 95%, transparent)' } : undefined}
                className={cn(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                  collapsed && 'justify-center px-2',
                  active
                    ? 'bg-sidebar-primary font-medium text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
              >
                {active && !collapsed ? (
                  <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sidebar-primary-foreground/70" aria-hidden="true" />
                ) : null}
                {!collapsed ? (
                  <span
                    className={cn(
                      'w-4 text-right font-mono text-[0.7rem] tabular-nums',
                      active ? 'text-sidebar-primary-foreground/60' : 'text-sidebar-foreground/40',
                    )}
                  >
                    {indexOf(item.href)}
                  </span>
                ) : null}
                <item.icon
                  className={cn(
                    'size-4 shrink-0 transition-transform group-hover:scale-110',
                    active && 'drop-shadow-[0_0_6px_color-mix(in_oklab,var(--sidebar-primary-foreground)_60%,transparent)]',
                  )}
                  aria-hidden="true"
                />
                {!collapsed ? <span className="truncate">{item.label}</span> : null}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

function Brand({ collapsed = false }) {
  return (
    <div className={cn('flex items-center gap-3 px-3', collapsed && 'justify-center px-0')}>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-info font-mono text-xs font-bold text-white shadow-[0_6px_18px_-6px_color-mix(in_oklab,var(--primary)_90%,transparent)]">
        NS
      </div>
      {!collapsed ? (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold text-sidebar-foreground">NetSim</p>
          <p className="truncate text-xs text-sidebar-foreground/60">Smart Campus Network</p>
        </div>
      ) : null}
    </div>
  )
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
      className="inline-flex size-8 items-center justify-center rounded-lg border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {dark ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
    </button>
  )
}

function NetworkStatus() {
  const { network } = useNetwork()
  const errors = validateNetwork(network).filter((i) => i.severity === 'error').length
  return (
    <StatusPill tone={errors ? 'warn' : 'success'}>
      <span className={cn('size-1.5 rounded-full', errors ? 'bg-warning' : 'animate-pulse bg-success')} aria-hidden="true" />
      {errors ? `${errors} issue${errors > 1 ? 's' : ''}` : 'Operational'}
    </StatusPill>
  )
}

function ResetNetwork() {
  const { resetNetwork } = useNetwork()
  const [confirming, setConfirming] = useState(false)
  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="hidden text-xs font-medium sm:inline">Reset to the default plan?</span>
        <button
          type="button"
          onClick={() => {
            resetNetwork()
            setConfirming(false)
          }}
          className="rounded-md bg-destructive px-2.5 py-1 text-xs font-medium text-white hover:bg-destructive/90"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
    >
      <RotateCcw className="size-3.5" aria-hidden="true" />
      <span className="hidden sm:inline">Reset network</span>
    </button>
  )
}

export function AppShell({ children }) {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const { pathname } = useLocation()
  const { hydrated, savedAt } = useNetwork()
  const current = NAV_ITEMS.find((n) => (n.href === '/' ? pathname === '/' : pathname.startsWith(n.href)))

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className={cn('min-h-dvh transition-[padding] duration-300', collapsed ? 'lg:pl-[76px]' : 'lg:pl-64')}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col gap-5 border-r border-sidebar-border bg-sidebar py-5 transition-[width] duration-300 lg:flex',
          collapsed ? 'w-[76px]' : 'w-64',
        )}
        aria-label="Primary"
      >
        <div className="flex items-center justify-between pr-3">
          <Brand collapsed={collapsed} />
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="rounded-md p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="size-4" aria-hidden="true" /> : <PanelLeftClose className="size-4" aria-hidden="true" />}
          </button>
        </div>
        <NavList collapsed={collapsed} />
        {!collapsed ? (
          <p className="px-5 text-xs leading-relaxed text-sidebar-foreground/45">
            Educational simulation. It does not control Cisco Packet Tracer or real devices.
          </p>
        ) : (
          <p className="px-2 text-center text-[10px] leading-tight text-sidebar-foreground/40">Sim only</p>
        )}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/50 backdrop-blur-sm"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          />
          <div className="animate-fade relative flex h-full w-72 max-w-[85%] flex-col gap-5 border-r border-sidebar-border bg-sidebar py-5">
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-sidebar-foreground hover:bg-sidebar-accent"
                aria-label="Close navigation"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <NavList onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}

      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border/70 bg-background/80 px-4 backdrop-blur-xl lg:px-8">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-md p-1.5 hover:bg-muted lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <Activity className="size-3 text-primary" aria-hidden="true" /> campus-lab-01
            </p>
            <p className="truncate text-sm font-semibold">{current?.label ?? 'Smart Campus Network'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground md:inline" aria-live="polite">
            {!hydrated ? 'Loading saved configuration…' : savedAt ? `Saved · ${new Date(savedAt).toLocaleTimeString()}` : 'Not saved yet'}
          </span>
          <NetworkStatus />
          <ThemeToggle />
          <ResetNetwork />
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
        {hydrated ? (
          <div key={pathname} className="animate-fade-up">
            {children}
          </div>
        ) : (
          <div className="flex items-center gap-2 py-20 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading the saved network configuration…
          </div>
        )}
      </main>
    </div>
  )
}
