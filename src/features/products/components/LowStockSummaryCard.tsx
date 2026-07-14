import { AlertTriangle, PackageCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { Spinner } from '@/components/Spinner'
import { useLowStockAlerts } from '@/features/products/hooks/useLowStockAlerts'

const PREVIEW_COUNT = 4

export function LowStockSummaryCard() {
  const { user } = useAuth()
  const { alerts, count, loading, hasLoadedOnce } = useLowStockAlerts()
  const canViewProducts = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.MANAGE_PRODUCTS)
  const preview = alerts.slice(0, PREVIEW_COUNT)

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-warning-100 text-warning-600">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-900">Low stock</p>
            <p className="text-xs text-neutral-500">Products at or below threshold</p>
          </div>
        </div>
        {hasLoadedOnce && count > 0 && <span className="text-2xl font-semibold text-warning-600">{count}</span>}
      </div>

      <div className="mt-4">
        {loading && !hasLoadedOnce && (
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <Spinner size={14} />
            Loading…
          </div>
        )}

        {hasLoadedOnce && count === 0 && (
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <PackageCheck className="h-4 w-4 text-accent-600" />
            You're all stocked up.
          </div>
        )}

        {hasLoadedOnce && count > 0 && (
          <ul className="flex flex-col gap-2">
            {preview.map((product) => (
              <li key={product.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-neutral-700">{product.name}</span>
                <span className="shrink-0 text-neutral-500">
                  {product.quantityOnHand} / {product.lowStockThreshold ?? '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canViewProducts && hasLoadedOnce && count > 0 && (
        <Link to="/products/low-stock" className="mt-4 inline-block text-sm font-medium text-primary-600 hover:underline">
          View all {count} low-stock products
        </Link>
      )}
    </div>
  )
}
