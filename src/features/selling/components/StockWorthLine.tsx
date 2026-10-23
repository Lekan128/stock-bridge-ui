import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { api } from '@/api/client'
import { viewingBranchId } from '@/features/branches/viewingBranch'
import { useApiQuery } from '@/data/useApiQuery'
import { useSellingPolicy } from '@/features/selling/useSellingPolicy'
import { formatNairaCompact } from '@/utils/money'

interface StockWorth {
  valueAtCost: number
  valueAtSellingPrice: number
  activeProductCount: number
  productsWithoutCost: number
  productsWithoutSellingPrice: number
}

/**
 * "Stock worth ₦4.2m at cost, ₦5.1m at your prices (40 have no selling price)" - one line above the
 * Inventory list, not a row of tiles (`SELLING_PRICE_PLAN.md` §6.5). For a company that sells, and
 * only to people who see the company's figures (VIEW_ANALYTICS, as the API).
 */
export function StockWorthLine() {
  const { user } = useAuth()
  const { recordsSales } = useSellingPolicy()
  const canSee = recordsSales && user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.VIEW_ANALYTICS)
  const { data } = useApiQuery<StockWorth>({
    queryKey: ['stock-worth'],
    // At a branch, what that branch holds is worth (V51).
    queryFn: () => api.get<StockWorth>('/api/analytics/stock-worth', { params: { branchId: viewingBranchId() } }).then((r) => r.data),
    fallbackError: "Couldn't work out what the stock is worth.",
    enabled: canSee,
    staleTime: 60_000,
  })
  if (!canSee || !data || data.activeProductCount === 0) return null
  const missing = data.productsWithoutSellingPrice
  return (
    <p className="text-sm text-neutral-600" data-stock-worth>
      Stock worth <span className="font-medium tabular-nums text-neutral-900">{formatNairaCompact(data.valueAtCost)}</span> at cost,{' '}
      <span className="font-medium tabular-nums text-neutral-900">{formatNairaCompact(data.valueAtSellingPrice)}</span> at your prices
      {missing > 0 && ` (${missing.toLocaleString()} ${missing === 1 ? 'has' : 'have'} no selling price)`}.
    </p>
  )
}
