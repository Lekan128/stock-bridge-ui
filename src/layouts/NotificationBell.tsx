import { useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { Spinner } from '@/components/Spinner'
import { useLowStockAlerts } from '@/features/products/hooks/useLowStockAlerts'
import { useClickOutside } from '@/hooks/useClickOutside'
import { useBellNotifications, type BellNotification, type BellNotificationTone } from '@/layouts/useBellNotifications'

const MAX_VISIBLE = 6

const toneClasses: Record<BellNotificationTone, string> = {
  warning: 'text-warning-500',
  info: 'text-primary-500',
  success: 'text-accent-600',
  danger: 'text-danger-500',
}

function NotificationRow({ notification, onNavigate }: { notification: BellNotification; onNavigate: () => void }) {
  const Icon = notification.icon
  const body = (
    <>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-neutral-900">{notification.title}</p>
        {notification.detail && <p className="mt-0.5 text-xs text-neutral-500">{notification.detail}</p>}
      </div>
      <Icon className={`h-4 w-4 shrink-0 ${toneClasses[notification.tone]}`} aria-hidden="true" />
    </>
  )

  return (
    <li>
      {notification.link ? (
        <Link
          to={notification.link}
          onClick={onNavigate}
          className="-mx-1 flex items-center justify-between gap-3 rounded-md px-1 py-2 hover:bg-neutral-50"
        >
          {body}
        </Link>
      ) : (
        <div className="flex items-center justify-between gap-3 py-2">{body}</div>
      )}
    </li>
  )
}

/**
 * Topbar notification bell. It renders one mixed, pre-sorted list and knows nothing about where
 * the rows came from — see `useBellNotifications` for the sources and the extension point that M7
 * fills in with server notifications.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  const { user } = useAuth()
  const { notifications, unreadCount, loading, hasLoadedOnce, error, markAllRead, canMarkAllRead } =
    useBellNotifications()
  // The "view all low-stock products" footer link is specific to that one source, so the count
  // still comes straight from it rather than from the merged list.
  const { count: lowStockCount } = useLowStockAlerts()
  const canViewProducts = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.VIEW_PRODUCTS)

  const visible = notifications.slice(0, MAX_VISIBLE)
  const badgeCount = unreadCount > 9 ? '9+' : unreadCount
  const isEmpty = notifications.length === 0

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-2 text-neutral-500 hover:bg-neutral-100"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-warning-500 px-1 text-[10px] font-semibold leading-none text-white">
            {badgeCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 sm:hidden" aria-hidden="true" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-xl border border-neutral-200 bg-white p-4 shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:bottom-auto sm:top-full sm:mt-2 sm:max-h-96 sm:w-80 sm:rounded-lg sm:p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-neutral-900">Notifications</p>
              {canMarkAllRead && (
                <button
                  type="button"
                  onClick={() => markAllRead()}
                  className="rounded text-xs font-medium text-primary-600 hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            {loading && !hasLoadedOnce && (
              <div className="flex items-center justify-center py-6 text-neutral-400">
                <Spinner size={18} />
              </div>
            )}

            {hasLoadedOnce && isEmpty && (
              <p className="mt-1 py-3 text-sm text-neutral-500">
                {error ? error : "You're all caught up — no alerts or updates right now."}
              </p>
            )}

            {!isEmpty && (
              <>
                <ul className="mt-2 flex flex-col divide-y divide-neutral-100">
                  {visible.map((notification) => (
                    <NotificationRow
                      key={notification.id}
                      notification={notification}
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </ul>
                {lowStockCount > MAX_VISIBLE && canViewProducts && (
                  <Link
                    to="/app/products/low-stock"
                    onClick={() => setOpen(false)}
                    className="mt-2 block rounded-md py-1.5 text-center text-sm font-medium text-primary-600 hover:bg-neutral-50"
                  >
                    View all {lowStockCount} low-stock products
                  </Link>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
