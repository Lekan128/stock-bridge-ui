import { Lock } from 'lucide-react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { DashboardAnalytics } from '@/features/dashboard/components/DashboardAnalytics'
import { useCatalogList, useCatalogState } from '@/features/catalog/useCatalog'
import { NeedsYouToday } from '@/features/dashboard/components/NeedsYouToday'
import { StockHealth } from '@/features/dashboard/components/StockHealth'
import { SetupChecklist } from '@/features/onboarding/SetupChecklist'
import { VendorDashboardPage } from '@/features/vendor/pages/VendorDashboardPage'

/**
 * `/app` — the workspace home, which is a different screen depending on what kind of account
 * is looking at it.
 *
 * A VENDOR gets the seller's dashboard: who is waiting on them, what they are owed, what has
 * run out, which listings are stuck in review. Everything below this branch is a BUYER's
 * dashboard — stock movements into their own store, what they spent — and none of those
 * questions have an answer for an account that cannot place an order. Showing a seller a
 * screen about buying is the clearest possible signal that the app has not noticed what they
 * are.
 *
 * `isVendor` and not `isSeller` on purpose. ProcurePal sells too, but it also buys and runs
 * its own inventory through this app, so the ordinary dashboard is genuinely its dashboard —
 * its selling figures live on `/app/selling/analytics`, which it also reaches. This is the one
 * place in the whole feature where the vendor/seller distinction goes the other way, which is
 * why it is stated here rather than left to the reader.
 *
 * Not a route swap in the router: `/app` is one route with one meaning ("home"), and giving it
 * two paths would mean every link, redirect and bookmark in the app having to know which one
 * the current account gets.
 */
export function DashboardPage() {
  const { user, isVendor } = useAuth()
  const permissions = user?.type === 'tenant' ? user.permissions : []
  const canViewAnalytics = permissions.includes(PERMISSIONS.VIEW_ANALYTICS)
  const canViewProducts = permissions.includes(PERMISSIONS.VIEW_PRODUCTS)

  if (isVendor) {
    return <VendorDashboardPage />
  }

  return <BuyerToday canViewAnalytics={canViewAnalytics} canViewProducts={canViewProducts} permissions={permissions} />
}

/**
 * The buying company's home, as "today" rather than a grid of stat cards (C5): how the stock
 * stands, what needs someone's hands, then how stock has moved. Health and the to-do list read the
 * device copy, so they answer offline; the charts say when their figures were true.
 */
function BuyerToday({
  canViewAnalytics,
  canViewProducts,
  permissions,
}: {
  canViewAnalytics: boolean
  canViewProducts: boolean
  permissions: string[]
}) {
  const catalog = useCatalogState()
  const onDevice = catalog.phase === 'ready'
  const list = useCatalogList(
    { search: '', status: 'active', categoryId: '', stockStatus: 'all', sort: { field: 'name', direction: 'asc' } },
    canViewProducts && onDevice,
  )
  const counts = onDevice && list.ready ? list.counts : null
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
        <p className="text-sm text-neutral-500">{today}</p>
      </div>

      <SetupChecklist />

      {canViewProducts && <StockHealth counts={counts} />}

      {canViewProducts && (
        <NeedsYouToday
          canStockIn={permissions.includes(PERMISSIONS.STOCK_IN)}
          canReceive={permissions.includes(PERMISSIONS.MANAGE_INVENTORY)}
        />
      )}

      {canViewAnalytics ? (
        <DashboardAnalytics />
      ) : (
        <p className="flex items-center gap-2 text-sm text-neutral-500">
          <Lock className="h-4 w-4" aria-hidden="true" />
          Movement charts need the analytics permission — ask an administrator if you need them.
        </p>
      )}
    </div>
  )
}
