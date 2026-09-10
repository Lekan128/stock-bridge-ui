import { Lock } from 'lucide-react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { DashboardAnalytics } from '@/features/dashboard/components/DashboardAnalytics'
import { LowStockSummaryCard } from '@/features/products/components/LowStockSummaryCard'
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

  if (canViewAnalytics) {
    return <DashboardAnalytics />
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
        <p className="text-sm text-neutral-500">An overview of what needs your attention.</p>
      </div>

      {canViewProducts && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <LowStockSummaryCard />
        </div>
      )}

      <div className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
          <Lock className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-neutral-900">Analytics not available</p>
          <p className="text-sm text-neutral-500">
            You don't have access to analytics. Ask an administrator to grant you the analytics permission.
          </p>
        </div>
      </div>
    </div>
  )
}
