import { Lock } from 'lucide-react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { DashboardAnalytics } from '@/features/dashboard/components/DashboardAnalytics'
import { LowStockSummaryCard } from '@/features/products/components/LowStockSummaryCard'

export function DashboardPage() {
  const { user } = useAuth()
  const permissions = user?.type === 'tenant' ? user.permissions : []
  const canViewAnalytics = permissions.includes(PERMISSIONS.VIEW_ANALYTICS)
  const canViewProducts = permissions.includes(PERMISSIONS.VIEW_PRODUCTS)

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
