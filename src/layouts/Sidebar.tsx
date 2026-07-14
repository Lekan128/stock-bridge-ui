import { ChevronLeft, ChevronRight } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Logo } from '@/components/Logo'
import { NAV_ITEMS } from '@/layouts/navConfig'

export interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: SidebarProps) {
  const { user, client } = useAuth()
  const permissions = user?.type === 'tenant' ? user.permissions : []
  const items = NAV_ITEMS.filter((item) => !item.requiredPermission || permissions.includes(item.requiredPermission))

  function renderNav(showLabels: boolean) {
    return items.map((item) => (
      <NavLink
        key={item.path}
        to={item.path}
        end={item.path === '/'}
        onClick={onCloseMobile}
        title={showLabels ? undefined : item.label}
        className={({ isActive }) =>
          `group flex items-center gap-3 rounded-md border-l-2 px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive
              ? 'border-accent-600 bg-neutral-50 text-neutral-900'
              : 'border-transparent text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
          }`
        }
      >
        <item.icon className="h-5 w-5 shrink-0" />
        {showLabels && <span className="truncate">{item.label}</span>}
      </NavLink>
    ))
  }

  function renderFooter(showLabels: boolean) {
    const tenantLabel = client?.name ?? client?.identifier ?? ''
    return (
      <div className="mt-auto border-t border-neutral-200 px-4 py-3">
        {showLabels ? (
          <p className="truncate text-xs font-medium text-neutral-400" title={tenantLabel}>
            {tenantLabel}
          </p>
        ) : (
          <div className="flex justify-center" title={tenantLabel}>
            <div className="h-2 w-2 rounded-full bg-neutral-300" />
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-neutral-200 bg-white transition-[width] duration-200 ease-out md:flex ${
          collapsed ? 'md:w-20' : 'md:w-64'
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          <Logo variant={collapsed ? 'icon' : 'full'} size={26} />
          <button
            type="button"
            onClick={onToggleCollapse}
            className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">{renderNav(!collapsed)}</nav>
        {renderFooter(!collapsed)}
      </aside>

      {/* Mobile backdrop */}
      <div
        onClick={onCloseMobile}
        aria-hidden="true"
        className={`fixed inset-0 z-30 bg-neutral-900/40 transition-opacity duration-200 ease-out md:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-neutral-200 bg-white transition-transform duration-200 ease-out md:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center px-4 py-4">
          <Logo variant="full" size={26} />
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">{renderNav(true)}</nav>
        {renderFooter(true)}
      </aside>
    </>
  )
}
