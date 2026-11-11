import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Logo } from '@/components/Logo'
import { NAV_GROUPS, type NavGroup, type NavItem } from '@/layouts/navConfig'
import { useSellingPolicy } from '@/features/selling/useSellingPolicy'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'

export interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

// The active item is a filled pill (B2) — the green left stripe it replaces was one of the
// border accents Impeccable flags as template-generic (plan §1.3).
const itemClassName = (isActive: boolean) =>
  `group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-primary-100 text-primary-900' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
  }`

/** How long the pointer rests on the collapsed strip before it opens: Baymard's 300-500 ms, at the calm end. */
const PEEK_OPEN_MS = 500
/** How long after the pointer leaves before it closes, so a slip off the edge doesn't snap it shut (NN/g). */
const PEEK_CLOSE_MS = 300

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: SidebarProps) {
  // Collapsed, it opens over the page while the pointer rests on it, and closes when it leaves (owner, 2026-11-10).
  // A peek never changes the choice: » still keeps it open. A mouse only - a touch screen has no hover.
  const [peek, setPeek] = useState(false)
  const timer = useRef<number | null>(null)
  const asideRef = useRef<HTMLElement>(null)
  const clearTimer = () => {
    if (timer.current != null) window.clearTimeout(timer.current)
    timer.current = null
  }
  const later = (ms: number, open: boolean) => {
    clearTimer()
    timer.current = window.setTimeout(() => setPeek(open), ms)
  }
  useEffect(() => clearTimer, [])
  // Pinned open or closed with the button: no peek left over.
  useEffect(() => {
    clearTimer()
    setPeek(false)
  }, [collapsed])
  const showLabels = !collapsed || peek
  const { user, client, isPlatformOwner, isVendor, isSeller } = useAuth()
  const permissions = user?.type === 'tenant' ? user.permissions : []
  const { recordsSales } = useSellingPolicy()
  const isMultiBranch = useOptionalWorkingBranch()?.isMultiBranch ?? false

  // Two independent kinds of filter, and they are not interchangeable.
  //
  // The three group flags are about the COMPANY — is it the platform owner, does it sell, is
  // it a vendor — and none of them can be a permission: permissions hang off global roles, so
  // every tenant's OWNER holds MANAGE_MARKETPLACE* and MANAGE_DELIVERY_ADDRESSES whatever kind
  // of company they work for. See NavGroup for each flag's reasoning.
  //
  // The item filter is about the USER — which of this group's screens is their job. Both are
  // needed and neither is sufficient; this mirrors the two independent gates the API puts on
  // the same routes.
  const groups: NavGroup[] = NAV_GROUPS.filter((group) => !group.platformOwnerOnly || isPlatformOwner)
    .filter((group) => !group.sellerOnly || isSeller)
    .filter((group) => !group.hideFromVendors || !isVendor)
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => !item.hideFromPlatformOwner || !isPlatformOwner)
        .filter((item) => !item.recordsSalesOnly || recordsSales)
        .filter((item) => !item.multiBranchOnly || isMultiBranch)
        .filter((item) => !item.anyOfPermissions || item.anyOfPermissions.some((code) => permissions.includes(code)))
        .filter((item) => !item.requiredPermission || permissions.includes(item.requiredPermission)),
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
          onClick={() => {
            onCloseMobile()
            setPeek(false)
          }}
          title={showLabels ? undefined : item.soon ? `${item.label} (opening soon)` : item.label}
          className={itemClassName(false)}
        >
          <item.icon className="h-5 w-5 shrink-0" />
          {showLabels && (
            <>
              <span className="truncate">{item.label}</span>
              {item.soon ? (
                // A word, not a colour: it has to read on its own (DESIGN.md, "say a state once").
                <span className="ml-auto shrink-0 rounded-sm bg-primary-50 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-primary-700">
                  Soon
                </span>
              ) : (
                <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-neutral-500" aria-hidden="true" />
              )}
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
        onClick={() => {
          onCloseMobile()
          setPeek(false)
        }}
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
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{group.label}</p>
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
          <p className="truncate text-xs font-medium text-neutral-500" title={tenantLabel}>
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
      {/* Desktop sidebar. The outer box keeps the strip's place in the page; the panel inside opens over the page when
          it peeks, so the page never shifts sideways. */}
      <div
        className={`relative hidden shrink-0 transition-[width] duration-200 ease-out md:block ${collapsed ? 'md:w-20' : 'md:w-64'}`}
        onPointerEnter={(event) => {
          if (collapsed && event.pointerType === 'mouse') later(peek ? 0 : PEEK_OPEN_MS, true)
        }}
        onPointerLeave={(event) => {
          if (collapsed && event.pointerType === 'mouse') later(PEEK_CLOSE_MS, false)
        }}
        // A keyboard opens it too: tabbing into the strip, and Esc or tabbing out closes it.
        onFocus={(event) => {
          // Keyboard focus only: a mouse click focuses the icon too, and mustn't flash the panel open.
          if (collapsed && (event.target as HTMLElement).matches(':focus-visible')) {
            clearTimer()
            setPeek(true)
          }
        }}
        onBlur={(event) => {
          if (collapsed && !asideRef.current?.contains(event.relatedTarget as Node | null)) {
            clearTimer()
            setPeek(false)
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && peek) {
            clearTimer()
            setPeek(false)
            ;(document.activeElement as HTMLElement | null)?.blur()
          }
        }}
      >
        <aside
          ref={asideRef}
          data-sidebar-peek={peek || undefined}
          className={`absolute inset-y-0 left-0 flex flex-col border-r border-neutral-200 bg-white transition-[width,box-shadow] duration-200 ease-out ${
            showLabels ? 'w-64' : 'w-20'
          } ${peek ? 'z-40 shadow-xl' : ''}`}
        >
          <div className="flex items-center justify-between gap-2 px-4 py-4">
            <Logo variant={showLabels ? 'full' : 'icon'} size={26} />
            <button
              type="button"
              onClick={onToggleCollapse}
              className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-600"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Keep the menu open' : undefined}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
          <nav className="flex-1 overflow-x-hidden overflow-y-auto px-3 pb-3">{renderNav(showLabels)}</nav>
          {renderFooter(showLabels)}
        </aside>
      </div>

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
