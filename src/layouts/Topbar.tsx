import { Menu, WifiOff } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { findNavItemForPath } from '@/layouts/navConfig'
import { NotificationBell } from '@/layouts/NotificationBell'
import { UserMenu } from '@/layouts/UserMenu'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { OutboxIndicator } from '@/features/outbox/OutboxIndicator'

export interface TopbarProps {
  onOpenMobileSidebar: () => void
}

export function Topbar({ onOpenMobileSidebar }: TopbarProps) {
  const location = useLocation()
  const online = useOnlineStatus()
  // Routes without a nav entry (profile, order detail, the marketplace admin sub-pages) fall back
  // to the product name rather than showing a stale title from a prefix match.
  const pageTitle = findNavItemForPath(location.pathname)?.label ?? 'Procure Paddy'

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        {/* Not a heading, and only on phones. Every workspace page owns its own <h1>; repeating
            the title here gave each screen two h1s and, on a laptop, said "Inventory" twice in the
            first 100px. On a phone it stays as the section name beside the menu button, because
            the page's own heading scrolls away and the sidebar that would say where you are is
            hidden. */}
        <p className="truncate text-base font-semibold text-neutral-900 md:hidden">{pageTitle}</p>
      </div>
      <div className="flex items-center gap-2">
        {!online && (
          <span
            role="status"
            className="inline-flex items-center gap-1.5 rounded-sm border border-warning-200 bg-warning-50 px-2 py-1 text-xs font-medium text-warning-800"
            title="No connection. What's on screen stays here; saving needs a connection."
          >
            <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
            Offline
          </span>
        )}
        <OutboxIndicator />
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  )
}
