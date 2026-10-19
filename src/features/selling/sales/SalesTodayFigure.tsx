import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAnalyticsSummary } from '@/features/analytics/hooks/useAnalyticsSummary'
import { formatMoney } from '@/features/selling/money'

/**
 * The dashboard's one primary figure, for a company that sells (`SELLING_PRICE_PLAN.md` §6.10):
 *
 *   **Sales today ₦86,500** · 14 sales
 *   ₦12,400 profit · up 8% on last Monday
 *
 * Compared with the same day last week up to the same time - Monday's trade is not Saturday's, so
 * "vs yesterday" would mislead most days, and a whole last Monday against half of today would read
 * as a bad day every morning. The figure links to the Sales page.
 */
export function SalesTodayFigure() {
  // Frozen when the dashboard opens: a moving "now" would be a new request every render.
  const [range] = useState(() => {
    const now = new Date()
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return { from: start.toISOString(), to: now.toISOString() }
  })
  const summary = useAnalyticsSummary(range)
  const sales = summary.data?.sales
  const previous = summary.data?.previousSales
  if (!sales) return null

  const weekday = new Date().toLocaleDateString(undefined, { weekday: 'long' })
  const change =
    previous && previous.salesAmount > 0
      ? Math.round(((sales.salesAmount - previous.salesAmount) / previous.salesAmount) * 100)
      : null
  const comparison =
    change == null
      ? previous && sales.salesAmount > 0
        ? `nothing by now last ${weekday}`
        : null
      : change === 0
        ? `level with last ${weekday}`
        : `${change > 0 ? 'up' : 'down'} ${Math.abs(change)}% on last ${weekday}`
  const profit = (sales.profitKnownSalesAmount ?? 0) > 0 && sales.grossProfit != null ? `${formatMoney(sales.grossProfit)} profit` : null

  return (
    <section aria-labelledby="sales-today-heading" className="rounded-lg border border-neutral-200 bg-white p-5">
      <Link
        to="/app/sales"
        className="flex flex-col gap-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <h2 id="sales-today-heading" className="text-sm font-medium text-neutral-600">
          Sales today
        </h2>
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-3xl font-semibold tabular-nums text-neutral-900" data-sales-today>
            {formatMoney(sales.salesAmount)}
          </span>
          <span className="text-sm text-neutral-600 tabular-nums">
            · {sales.saleCount} {sales.saleCount === 1 ? 'sale' : 'sales'}
          </span>
        </p>
        {(profit || comparison) && (
          <p className="text-sm text-neutral-600 tabular-nums">{[profit, comparison].filter(Boolean).join(' · ')}</p>
        )}
      </Link>
    </section>
  )
}
