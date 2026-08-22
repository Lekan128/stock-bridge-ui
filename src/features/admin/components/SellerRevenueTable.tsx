import { ArrowDown, ArrowUp, ArrowUpDown, Minus, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { formatCompactCurrency, formatNumber } from '@/components/analytics/formatters'
import { formatShare } from '@/features/marketplace/analytics/formatters'
import type { SellerRevenueEntry, SellerRevenueSort } from '@/features/admin/types'
import { formatNaira } from '@/utils/money'

export interface SellerRevenueTableProps {
  entries: SellerRevenueEntry[]
  sort: SellerRevenueSort
  /** Undefined means "the server's natural direction for this key" — see onSortChange. */
  ascending?: boolean
  onSortChange: (sort: SellerRevenueSort, ascending?: boolean) => void
}

const columns: { field: SellerRevenueSort; label: string; align?: 'right' }[] = [
  { field: 'NAME', label: 'Seller' },
  { field: 'REVENUE', label: 'Revenue', align: 'right' },
  { field: 'GROWTH', label: 'vs previous', align: 'right' },
  { field: 'ORDERS', label: 'Orders', align: 'right' },
  { field: 'AVERAGE_ORDER_VALUE', label: 'Avg order', align: 'right' },
  { field: 'UNITS', label: 'Units', align: 'right' },
]

/** Money and counts open biggest-first; a name column that opened Z–A would just look broken. */
function naturalAscending(field: SellerRevenueSort): boolean {
  return field === 'NAME'
}

/**
 * Growth as a badge: an arrow, a naira figure and a percentage where one exists.
 *
 * <p>`revenueGrowthRate` is ABSENT (not null — the API omits null fields) when the seller
 * took nothing in the previous window, because a percentage change from zero is undefined.
 * That case renders as "New", which is the true statement, rather than as +100% or ∞ — both
 * of which would be lies about a vendor's first trading month. The absolute change is always
 * shown, so the row is never information-free.
 *
 * <p>Colour is never the only signal: every state carries an icon and a word or a sign.
 */
function GrowthCell({ entry }: { entry: SellerRevenueEntry }) {
  if (entry.previousRevenue === 0 && entry.revenue === 0) {
    return <span className="inline-flex items-center gap-1 text-xs text-neutral-400"><Minus className="h-3.5 w-3.5" aria-hidden="true" />No sales</span>
  }
  if (entry.revenueGrowthRate == null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm bg-primary-50 px-1.5 py-0.5 text-xs font-medium text-primary-700">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        New this period
      </span>
    )
  }

  const rising = entry.revenueGrowth > 0
  const falling = entry.revenueGrowth < 0
  const Icon = rising ? TrendingUp : falling ? TrendingDown : Minus
  const tone = rising
    ? 'bg-accent-50 text-accent-700'
    : falling
      ? 'bg-danger-50 text-danger-700'
      : 'bg-neutral-100 text-neutral-600'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium tabular-nums ${tone}`}
      title={`${formatNaira(entry.previousRevenue)} in the previous period`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {formatShare(entry.revenueGrowthRate)}
      <span className="font-normal opacity-75">({formatCompactCurrency(entry.revenueGrowth)})</span>
    </span>
  )
}

/**
 * Who took what, and who is growing.
 *
 * <h2>Sorting happens on the server, unlike TenantBreakdownTable</h2>
 * That table sorts its rows in the browser, which is right for it: its data is one flat
 * response with no derived keys. Here two of the sort keys — average order value and growth —
 * are computed from TWO windows, and the server is the only place both windows exist. Sorting
 * half the columns locally and half remotely would be two behaviours behind one control, so
 * every header re-requests. The API's `ascending` is left UNDEFINED on a first click so its
 * per-key default applies (biggest-first for money, A–Z for name), and only a second click on
 * the same header sends an explicit direction.
 *
 * <h2>ProcurePal is a row like any other, and badged so</h2>
 * The question this screen exists to answer is how much of the marketplace's revenue is the
 * operator's own and how much is other people's, so netting ProcurePal off would delete the
 * comparison. The badge is what makes the two readable at a glance; the share column is what
 * makes the answer quantitative.
 */
export function SellerRevenueTable({ entries, sort, ascending, onSortChange }: SellerRevenueTableProps) {
  function handleSortChange(field: SellerRevenueSort) {
    if (field !== sort) {
      // First click on a new column: let the server pick the sensible direction.
      onSortChange(field, undefined)
      return
    }
    const current = ascending ?? naturalAscending(field)
    onSortChange(field, !current)
  }

  return (
    <table className="w-full border-separate border-spacing-0 text-sm">
      <thead>
        <tr>
          {columns.map((col) => {
            const active = sort === col.field
            const effectiveAscending = ascending ?? naturalAscending(col.field)
            return (
              <th
                key={col.field}
                scope="col"
                aria-sort={active ? (effectiveAscending ? 'ascending' : 'descending') : 'none'}
                className={`border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-xs font-medium text-neutral-500 ${
                  col.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSortChange(col.field)}
                  className={`inline-flex items-center gap-1 hover:text-neutral-700 ${
                    col.align === 'right' ? 'flex-row-reverse' : ''
                  }`}
                >
                  {col.label}
                  {active ? (
                    effectiveAscending ? (
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                    )
                  ) : (
                    <ArrowUpDown className="h-3.5 w-3.5 text-neutral-300" aria-hidden="true" />
                  )}
                </button>
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.sellerClientId} className="hover:bg-neutral-50">
            <td className="border-b border-neutral-100 px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-neutral-900">{entry.name}</span>
                {entry.platformOwner ? (
                  <Badge variant="info">ProcurePal</Badge>
                ) : (
                  <Badge variant="neutral">Vendor</Badge>
                )}
                {/* "Stopped selling" and "we switched them off" are different findings, and a
                    row at ₦0 cannot tell them apart on its own. */}
                {!entry.active && <Badge variant="danger">Suspended</Badge>}
              </div>
            </td>
            <td className="border-b border-neutral-100 px-4 py-2.5 text-right tabular-nums text-neutral-700">
              <span title={formatNaira(entry.revenue)}>{formatCompactCurrency(entry.revenue)}</span>
              <span className="ml-1.5 text-xs text-neutral-400">{formatShare(entry.revenueShare)}</span>
            </td>
            <td className="border-b border-neutral-100 px-4 py-2.5 text-right">
              <GrowthCell entry={entry} />
            </td>
            <td className="border-b border-neutral-100 px-4 py-2.5 text-right tabular-nums text-neutral-700">
              {formatNumber(entry.orderCount)}
            </td>
            <td className="border-b border-neutral-100 px-4 py-2.5 text-right tabular-nums text-neutral-700">
              <span title={formatNaira(entry.averageOrderValue)}>
                {formatCompactCurrency(entry.averageOrderValue)}
              </span>
            </td>
            <td className="border-b border-neutral-100 px-4 py-2.5 text-right tabular-nums text-neutral-700">
              {formatNumber(entry.unitsSold)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
