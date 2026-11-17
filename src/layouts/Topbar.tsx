import { Menu } from 'lucide-react'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { useLocation } from 'react-router-dom'
import { findNavItemForPath } from '@/layouts/navConfig'
import { NotificationBell } from '@/layouts/NotificationBell'
import { UserMenu } from '@/layouts/UserMenu'
import { AreaChip } from '@/features/branches/AreaChip'
import { BranchChip } from '@/features/branches/BranchChip'
import { SyncPill } from '@/features/sync/SyncPill'

export interface TopbarProps {
  onOpenMobileSidebar: () => void
}

export function Topbar({ onOpenMobileSidebar }: TopbarProps) {
  const location = useLocation()
  const branch = useOptionalWorkingBranch()
  // Routes without a nav entry (profile, order detail, the marketplace admin sub-pages) fall back
  // to the product name rather than showing a stale title from a prefix match.
  const pageTitle = findNavItemForPath(location.pathname)?.label ?? 'Procurepaddy'

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          // Never squeezed out by the branch and area chips (owner, 2026-11-17: "Head Office" hid it).
          className="shrink-0 rounded-md p-2 text-neutral-500 hover:bg-neutral-100 md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        {/* Not a heading, and only on phones. Every workspace page owns its own <h1>; repeating
            the title here gave each screen two h1s and, on a laptop, said "Inventory" twice in the
            first 100px. On a phone it stays as the section name beside the menu button, because
            the page's own heading scrolls away and the sidebar that would say where you are is
            hidden. */}
        {/* With branches, a phone gives this room to the branch and area chips: where you are matters more than the
            page's name, which its own heading says (owner, 2026-11-17: "Head Office" pushed the menu out). */}
        <p className={`min-w-0 truncate text-base font-semibold text-neutral-900 md:hidden ${branch?.isMultiBranch ? 'hidden sm:block' : ''}`}>
          {pageTitle}
        </p>
        {/* A page that wants the bar's empty left side on a large screen fills this (Record a sale's till: its
            title and the sales waiting). Empty everywhere else. */}
        <div id="topbar-page-slot" className="hidden min-w-0 items-center gap-3 lg:flex" />
      </div>
      {/* Tighter on a phone, so the page's name beside the menu button reads whole ("Inventory", not "Inve…"). */}
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        {/* Where this phone is (MULTI_BRANCH_UX_PLAN.md §4.1). Nothing at a one-branch company. */}
        <BranchChip />
        {/* …and where in it, for someone placed in particular areas (STOCK_AREAS_PART_3.md). */}
        <AreaChip />
        {/* Offline, waiting to send, sending, needs you, all caught up: one pill (A6). */}
        <SyncPill />
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  )
}
