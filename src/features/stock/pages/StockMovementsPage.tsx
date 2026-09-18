import { ArrowDownToLine, ArrowUpFromLine, PackagePlus, PackageMinus, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Pagination } from '@/components/Pagination'
import { Skeleton } from '@/components/Skeleton'
import { DateRangeControl } from '@/components/analytics/DateRangeControl'
import { defaultDateRange, toApiDateTime, type DateRange } from '@/components/analytics/dateRange'
import { formatCurrency, formatDateRange, formatNumber } from '@/components/analytics/formatters'
import { StatCard } from '@/components/analytics/StatCard'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { formatDateTime } from '@/features/marketplace/formatters'
import type { MovementType } from '@/features/products/types'
import { useStockMovementReport } from '@/features/stock/hooks/useStockMovementReport'
import { useVendorOptions } from '@/features/vendors/hooks/useVendorOptions'

const PAGE_SIZE = 25

type DirectionFilter = 'all' | MovementType

const DIRECTIONS: { value: DirectionFilter; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'IN', label: 'Stock in' },
  { value: 'OUT', label: 'Stock out' },
  { value: 'ADJUSTMENT', label: 'Adjustments' },
]

const MOVEMENT_BADGE: Record<MovementType, { label: string; variant: 'success' | 'warning' | 'neutral' }> = {
  IN: { label: 'In', variant: 'success' },
  OUT: { label: 'Out', variant: 'warning' },
  ADJUSTMENT: { label: 'Adjustment', variant: 'neutral' },
}

/**
 * The stock in/out report — route `/app/stock-movements`.
 *
 * <h2>What this screen is for</h2>
 * The dashboard says "you took in ₦4.2m of stock this month". This is the answer to the next
 * question, which the dashboard could not answer: *what*? Every delivery and every issue in the
 * range, with the product, the supplier, what was paid and what each line came to.
 *
 * <h2>It reconciles with the dashboard by construction</h2>
 * Both read the same ledger over the same `occurredAt` range — see the server's
 * `StockMovementSpecifications.forTenant`. That is why the dates here are *when the delivery
 * arrived*, not when somebody typed it in: a bulk import of last month's purchases belongs in last
 * month's numbers, which is the only reading that reconciles against an invoice.
 *
 * <h2>The totals come from the server, over the whole range</h2>
 * Not from `movements` — those are one page. A footer that totalled the 25 rows on screen would be
 * a number nobody asked for, and paging to the end to add up a month is not a report.
 *
 * <h2>MANAGE_INVENTORY, not VIEW_ANALYTICS</h2>
 * This is the raw ledger with costs and suppliers on every row, not an aggregate — the same data
 * the per-product stock history already shows, seen across all products at once. The API gates it
 * the same way; the nav entry and this guard mirror that rather than inventing a wider audience.
 */
export function StockMovementsPage() {
  const { user } = useAuth()
  const permissions = user?.type === 'tenant' ? user.permissions : []
  const canViewVendors = permissions.includes(PERMISSIONS.VIEW_VENDORS)

  /**
   * Seeded from the query string, once, so that arriving from a dashboard card lands on the rows
   * behind the number that was clicked rather than on this page's own default month.
   *
   * Read as the INITIAL state and never again: after the first render the controls own the
   * filters, and re-syncing from the URL would fight the user's next click. The URL is likewise
   * not rewritten as they filter — this is a report somebody reads, not a view they bookmark, and
   * making every dropdown push history would break the back button's only useful meaning here
   * (return to the dashboard).
   */
  const [searchParams] = useSearchParams()
  const [range, setRange] = useState<DateRange>(() => {
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    if (!from || !to) return defaultDateRange()
    const parsedFrom = new Date(from)
    const parsedTo = new Date(to)
    // An unparseable date falls back rather than rendering "Invalid Date" into the header and
    // sending NaN to the API.
    if (Number.isNaN(parsedFrom.getTime()) || Number.isNaN(parsedTo.getTime())) return defaultDateRange()
    return { preset: 'custom', from: parsedFrom, to: parsedTo }
  })
  const [direction, setDirection] = useState<DirectionFilter>(() => {
    const requested = searchParams.get('movementType')
    return requested === 'IN' || requested === 'OUT' || requested === 'ADJUSTMENT' ? requested : 'all'
  })
  const [companyVendorId, setCompanyVendorId] = useState('')
  const [page, setPage] = useState(0)

  const { vendors } = useVendorOptions(canViewVendors)

  const { movements, totalPages, totalElements, summary, loading, error, refetch } = useStockMovementReport({
    from: toApiDateTime(range.from),
    to: toApiDateTime(range.to),
    movementType: direction === 'all' ? undefined : direction,
    companyVendorId: companyVendorId || undefined,
    page,
    size: PAGE_SIZE,
  })

  const rangeLabel = formatDateRange(range.from, range.to)
  const showSkeleton = loading && movements.length === 0

  /** Any filter change resets to the first page — page 4 of the old filter means nothing here. */
  function applyFilter(change: () => void) {
    change()
    setPage(0)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Stock movements</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">
            Everything you took in and gave out, with what it cost. Dates are when the delivery or
            sale happened — not when it was entered — so backdated and imported stock lands in the
            period it really belongs to.
          </p>
        </div>
        <DateRangeControl value={range} onChange={(next) => applyFilter(() => setRange(next))} />
      </div>

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Stock in value"
            value={formatCurrency(summary.inValue)}
            subtitle={`${formatNumber(summary.inMovementCount)} deliveries · ${rangeLabel}`}
            icon={PackagePlus}
          />
          <StatCard
            label="Stock out value"
            value={formatCurrency(summary.outValue)}
            subtitle={`${formatNumber(summary.outMovementCount)} issues · ${rangeLabel}`}
            icon={PackageMinus}
          />
          <StatCard
            label="Units in"
            value={formatNumber(summary.inQuantity)}
            subtitle="Across every product's own stock unit"
            icon={ArrowDownToLine}
          />
          <StatCard
            label="Units out"
            value={formatNumber(summary.outQuantity)}
            subtitle="Across every product's own stock unit"
            icon={ArrowUpFromLine}
          />
        </div>
      )}

      {/* The one thing that makes the two numbers above reconcilable. Without it, a large "units
          in" against a smaller "stock in value" reads as a bug rather than as deliveries whose
          price nobody recorded. Shown only when there is actually a gap to explain. */}
      {summary && (summary.unpricedInCount > 0 || summary.unpricedOutCount > 0 || summary.adjustmentCount > 0) && (
        <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          {summary.unpricedInCount > 0 && (
            <>
              {formatNumber(summary.unpricedInCount)} deliveries in this range have no price recorded,
              so their units are counted but their value is not.{' '}
            </>
          )}
          {summary.unpricedOutCount > 0 && (
            <>{formatNumber(summary.unpricedOutCount)} stock-outs have no price recorded. </>
          )}
          {summary.adjustmentCount > 0 && (
            <>
              {formatNumber(summary.adjustmentCount)} adjustments are listed but counted in neither
              total — a stock-take correction is not a purchase or a sale.
            </>
          )}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="direction" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Show
          </label>
          <select
            id="direction"
            value={direction}
            onChange={(event) => applyFilter(() => setDirection(event.target.value as DirectionFilter))}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {DIRECTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Hidden rather than disabled for a user without VIEW_VENDORS: the options would be a
            request they are not allowed to make, and an empty picker looks broken. */}
        {canViewVendors && (
          <div>
            <label htmlFor="supplier" className="mb-1.5 block text-sm font-medium text-neutral-700">
              Supplier
            </label>
            <select
              id="supplier"
              value={companyVendorId}
              onChange={(event) => applyFilter(() => setCompanyVendorId(event.target.value))}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Any supplier</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {!showSkeleton && !error && (
          <p className="py-2 text-sm text-neutral-500">
            {formatNumber(totalElements)} movement{totalElements === 1 ? '' : 's'}
          </p>
        )}
      </div>

      {error && (
        <ErrorState
          variant={movements.length > 0 ? 'inline' : 'block'}
          title="We could not load stock movements"
          message={error}
          onRetry={refetch}
        />
      )}

      {showSkeleton && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-md" />
          ))}
        </div>
      )}

      {!showSkeleton && !error && movements.length === 0 && (
        <EmptyState
          icon={SlidersHorizontal}
          title="Nothing moved in this period"
          description="No stock came in or went out between these dates. Try a wider range, or clear the filters."
        />
      )}

      {movements.length > 0 && (
        <>
          {/* The table scrolls inside its own container rather than the page — eight columns do
              not fit a phone, and a horizontally scrolling page loses the nav. */}
          <div className={`overflow-x-auto rounded-lg border border-neutral-200 bg-white transition-opacity ${loading ? 'opacity-50' : ''}`}>
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Date</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Product</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Type</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Quantity</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Unit price</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Value</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Supplier</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {movements.map((movement) => {
                  const badge = MOVEMENT_BADGE[movement.movementType]
                  return (
                    <tr key={movement.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-neutral-600">
                        {/* occurredAt, falling back to createdAt for any row written before V20
                            gave the two separate meanings. */}
                        {formatDateTime(movement.occurredAt ?? movement.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-neutral-900">{movement.productName ?? '—'}</span>
                        {movement.productSku && (
                          <span className="mt-0.5 block font-mono text-xs text-neutral-400">
                            {movement.productSku}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-neutral-900">
                        {formatNumber(movement.quantity)}
                        {movement.unitOfMeasure && (
                          <span className="ml-1 text-xs text-neutral-400">{movement.unitOfMeasure}</span>
                        )}
                      </td>
                      {/* Em dash, never ₦0.00 — "no price recorded" is not "it was free". */}
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-neutral-600">
                        {movement.unitPriceAtTime == null ? '—' : formatCurrency(movement.unitPriceAtTime)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-medium text-neutral-900">
                        {movement.lineValue == null ? '—' : formatCurrency(movement.lineValue)}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">{movement.companyVendorName ?? '—'}</td>
                      <td className="max-w-xs px-4 py-3 text-neutral-500">{movement.note ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
