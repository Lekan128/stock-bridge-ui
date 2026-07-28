import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Logo } from '@/components/Logo'
import { NAV_GROUPS, type NavGroup, type NavItem } from '@/layouts/navConfig'

export interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

const itemClassName = (isActive: boolean) =>
  `group flex items-center gap-3 rounded-md border-l-2 px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? 'border-accent-600 bg-neutral-50 text-neutral-900'
      : 'border-transparent text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
  }`

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: SidebarProps) {
  const { user, client, isPlatformOwner } = useAuth()
  const permissions = user?.type === 'tenant' ? user.permissions : []

  // Two independent filters: the platform-owner flag decides whether ProcurePal's ops group
  // exists at all, permissions decide which of its items this particular user sees.
  const groups: NavGroup[] = NAV_GROUPS.filter((group) => !group.platformOwnerOnly || isPlatformOwner)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.requiredPermission || permissions.includes(item.requiredPermission)),
    }))
    .filter((group) => group.items.length > 0)

  function renderItem(item: NavItem, showLabels: boolean) {
    // The marketplace link leaves the workspace entirely, so NavLink's active state would be
    // meaningless (and `/` would match nothing here anyway).
    if (item.leavesWorkspace) {
      return (
        <Link
          key={item.path}
          to={item.path}
          onClick={onCloseMobile}
          title={showLabels ? undefined : item.label}
          className={itemClassName(false)}
        >
          <item.icon className="h-5 w-5 shrink-0" />
          {showLabels && (
            <>
              <span className="truncate">{item.label}</span>
              <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
            </>
          )}
        </Link>
      )
    }

    return (
      <NavLink
        key={item.path}
        to={item.path}
        end={item.exact}
        onClick={onCloseMobile}
        title={showLabels ? undefined : item.label}
        className={({ isActive }) => itemClassName(isActive)}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        {showLabels && <span className="truncate">{item.label}</span>}
      </NavLink>
    )
  }

  function renderNav(showLabels: boolean) {
    return groups.map((group, index) => (
      <div key={group.label ?? `group-${index}`} className={index > 0 ? 'mt-4' : ''}>
        {group.label &&
          (showLabels ? (
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">{group.label}</p>
          ) : (
            // Collapsed rail: a divider stands in for the heading so the grouping survives.
            <div className="mx-3 mb-2 border-t border-neutral-200" aria-hidden="true" />
          ))}
        <div className="flex flex-col gap-1">{group.items.map((item) => renderItem(item, showLabels))}</div>
      </div>
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
        <nav className="flex-1 overflow-y-auto px-3 pb-3">{renderNav(!collapsed)}</nav>
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
        <nav className="flex-1 overflow-y-auto px-3 pb-3">{renderNav(true)}</nav>
        {renderFooter(true)}
      </aside>
    </>
  )
}
