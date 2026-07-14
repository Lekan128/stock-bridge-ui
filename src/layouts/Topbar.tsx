import { Menu } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { NAV_ITEMS } from '@/layouts/navConfig'
import { NotificationBell } from '@/layouts/NotificationBell'
import { UserMenu } from '@/layouts/UserMenu'

export interface TopbarProps {
  onOpenMobileSidebar: () => void
}

export function Topbar({ onOpenMobileSidebar }: TopbarProps) {
  const location = useLocation()
  const pageTitle =
    NAV_ITEMS.find(
      (item) => item.path === location.pathname || (item.path !== '/' && location.pathname.startsWith(`${item.path}/`)),
    )?.label ?? 'Stock Bridge'

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-neutral-900">{pageTitle}</h1>
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  )
}
