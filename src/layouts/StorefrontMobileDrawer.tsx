import { useEffect } from 'react'
import { LayoutGrid, LayoutDashboard, LogIn, MapPin, ReceiptText, Store, UserPlus, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { buttonClassName } from '@/components/Button'
import { Logo } from '@/components/Logo'
import { useCategories } from '@/features/storefront/hooks/useCategories'

export interface StorefrontMobileDrawerProps {
  open: boolean
  onClose: () => void
}

const linkClass =
  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50'

/**
 * Mobile navigation drawer for the storefront. Search stays in the header rather than moving in
 * here — on a wholesale catalog, search is the primary way in and hiding it behind a hamburger
 * would cost a tap on every visit.
 */
export function StorefrontMobileDrawer({ open, onClose }: StorefrontMobileDrawerProps) {
  const { isAuthenticated, client, user } = useAuth()
  const { categories } = useCategories()
  const permissions = user?.type === 'tenant' ? user.permissions : []

  // Escape closes, matching every other overlay in the app.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const topLevel = categories.filter((category) => category.parentId === null)
  const visibleCategories = (topLevel.length > 0 ? topLevel : categories).slice(0, 12)

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-neutral-900/40 transition-opacity duration-200 ease-out md:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        // Hidden from assistive tech when off-screen, so its links aren't reachable by tab order.
        aria-hidden={!open}
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-neutral-200 bg-white transition-transform duration-200 ease-out md:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <Link to="/" onClick={onClose}>
            <Logo brand="procurePal" size={26} />
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <Link to="/" onClick={onClose} className={linkClass}>
            <Store className="h-4 w-4 text-neutral-400" />
            All products
          </Link>

          {isAuthenticated && (
            <>
              <Link to="/app" onClick={onClose} className={linkClass}>
                <LayoutDashboard className="h-4 w-4 text-neutral-400" />
                My workspace
              </Link>
              {permissions.includes(PERMISSIONS.VIEW_ORDERS) && (
                <Link to="/app/orders" onClick={onClose} className={linkClass}>
                  <ReceiptText className="h-4 w-4 text-neutral-400" />
                  My orders
                </Link>
              )}
              {permissions.includes(PERMISSIONS.MANAGE_DELIVERY_ADDRESSES) && (
                <Link to="/app/addresses" onClick={onClose} className={linkClass}>
                  <MapPin className="h-4 w-4 text-neutral-400" />
                  Delivery addresses
                </Link>
              )}
            </>
          )}

          {visibleCategories.length > 0 && (
            <>
              <p className="mt-4 flex items-center gap-2 px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                <LayoutGrid className="h-3.5 w-3.5" />
                Categories
              </p>
              {visibleCategories.map((category) => (
                <Link
                  key={category.id}
                  to={`/?categoryId=${category.id}`}
                  onClick={onClose}
                  className="block rounded-md px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                >
                  {category.name}
                </Link>
              ))}
            </>
          )}
        </nav>

        <div className="border-t border-neutral-200 p-4">
          {isAuthenticated ? (
            <div>
              <p className="text-xs text-neutral-500">Signed in as</p>
              <p className="truncate text-sm font-medium text-neutral-900">
                {client?.name ?? client?.identifier ?? user?.username}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Link to="/login" onClick={onClose} className={buttonClassName('primary', 'w-full')}>
                <LogIn className="h-4 w-4" />
                Log in
              </Link>
              <Link to="/signup" onClick={onClose} className={buttonClassName('secondary', 'w-full')}>
                <UserPlus className="h-4 w-4" />
                Create a business account
              </Link>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
