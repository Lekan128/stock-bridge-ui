import { useRef, useState } from 'react'
import { AlertTriangle, Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { Spinner } from '@/components/Spinner'
import { useLowStockAlerts } from '@/features/products/hooks/useLowStockAlerts'
import { useClickOutside } from '@/hooks/useClickOutside'

const MAX_VISIBLE = 6

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  const { user } = useAuth()
  const { alerts, count, loading, hasLoadedOnce, error } = useLowStockAlerts()
  const canViewProducts = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.MANAGE_PRODUCTS)

  const visibleAlerts = alerts.slice(0, MAX_VISIBLE)
  const badgeCount = count > 9 ? '9+' : count

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-2 text-neutral-500 hover:bg-neutral-100"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={count > 0 ? `Low-stock alerts, ${count} product${count === 1 ? '' : 's'}` : 'Low-stock alerts'}
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
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
            <p className="text-sm font-medium text-neutral-900">Low-stock alerts</p>

            {loading && !hasLoadedOnce && (
              <div className="flex items-center justify-center py-6 text-neutral-400">
                <Spinner size={18} />
              </div>
            )}

            {hasLoadedOnce && count === 0 && (
              <p className="mt-1 py-3 text-sm text-neutral-500">
                {error ? error : "You're all stocked up — no products below their threshold right now."}
              </p>
            )}

            {hasLoadedOnce && count > 0 && (
              <>
                <ul className="mt-2 flex flex-col divide-y divide-neutral-100">
                  {visibleAlerts.map((product) => {
                    const rowContent = (
                      <>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-neutral-900">{product.name}</p>
                          <p className="mt-0.5 text-xs text-neutral-500">
                            {product.quantityOnHand} on hand · threshold {product.lowStockThreshold ?? '—'}
                          </p>
                        </div>
                        <AlertTriangle className="h-4 w-4 shrink-0 text-warning-500" />
                      </>
                    )
                    return (
                      <li key={product.id}>
                        {canViewProducts ? (
                          <Link
                            to={`/products/${product.id}`}
                            onClick={() => setOpen(false)}
                            className="-mx-1 flex items-center justify-between gap-3 rounded-md px-1 py-2 hover:bg-neutral-50"
                          >
                            {rowContent}
                          </Link>
                        ) : (
                          <div className="flex items-center justify-between gap-3 py-2">{rowContent}</div>
                        )}
                      </li>
                    )
                  })}
                </ul>
                {count > MAX_VISIBLE && canViewProducts && (
                  <Link
                    to="/products/low-stock"
                    onClick={() => setOpen(false)}
                    className="mt-2 block rounded-md py-1.5 text-center text-sm font-medium text-primary-600 hover:bg-neutral-50"
                  >
                    View all {count} low-stock products
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
