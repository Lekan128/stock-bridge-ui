import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { useApiQuery } from '@/data/useApiQuery'
import { formatNumber, stockUnitWord } from '@/features/products/unitCopy'
import { formatMoney } from '@/features/selling/money'
import { salesReportApi } from '@/features/selling/sales/salesReportApi'
import type { SalesReport } from '@/features/selling/sales/types'
import { useSellingPolicy } from '@/features/selling/useSellingPolicy'

/**
 * "Sold this month: 42 pieces · ₦210,000 · ₦30,000 profit" on a product's page (`SELLING_PRICE_PLAN.md`
 * §6.6), linking to the Sales report. The report is VIEW_ANALYTICS, so the line is too - profit and
 * all. Nothing at all until the product has sold this month: an empty line is not information.
 */
export function SoldThisMonth({ productId, stockUnit }: { productId: string; stockUnit: string }) {
  const { user } = useAuth()
  const { recordsSales } = useSellingPolicy()
  const canSee = recordsSales && user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.VIEW_ANALYTICS)
  const [range] = useState(() => {
    const now = new Date()
    return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to: now.toISOString() }
  })
  const { data } = useApiQuery<SalesReport>({
    queryKey: ['sold-this-month', productId, range.from],
    queryFn: () => salesReportApi.report({ ...range, groupBy: 'product', productId }),
    fallbackError: "Couldn't load this product's sales.",
    enabled: canSee,
  })
  const row = data?.rows[0]
  if (!canSee || !row || row.totals.lineCount === 0) return null
  const quantity = row.quantity ?? 0
  const profit = (row.totals.profitKnownSalesAmount ?? 0) > 0 && row.totals.grossProfit != null ? row.totals.grossProfit : null
  return (
    <p className="text-sm text-neutral-600" data-sold-this-month>
      <Link to="/app/sales" className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
        Sold this month:{' '}
        <span className="font-medium tabular-nums text-neutral-900">
          {formatNumber(quantity)} {stockUnitWord(stockUnit, quantity)} · {formatMoney(row.totals.salesAmount)}
        </span>
        {profit != null && <span className="tabular-nums"> · {formatMoney(profit)} profit</span>}
      </Link>
    </p>
  )
}
