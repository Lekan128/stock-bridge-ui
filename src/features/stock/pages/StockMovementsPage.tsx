import { AreaUseLine } from '@/features/stock/components/AreaUseLine'
import { useWorkArea } from '@/features/branches/workArea'
import { ArrowDownToLine, ArrowUpFromLine, Download, PackagePlus, PackageMinus, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { hasAreas } from '@/features/branches/areas'
import { MovesList } from '@/features/moves/MovesList'
import { RequestsList } from '@/features/requests/RequestsList'
import { useToast } from '@/components/useToast'
import { stockMovementsApi } from '@/features/stock/api/stockMovementsApi'
import { downloadBlob } from '@/utils/downloadBlob'
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
import type { MovementType, OutReason, StockMovement } from '@/features/products/types'
import { useStockMovementReport } from '@/features/stock/hooks/useStockMovementReport'
import { NO_REASON_LABEL, OUT_REASONS, outReasonLabel } from '@/features/stock/outReasons'
import { useVendorOptions } from '@/features/vendors/hooks/useVendorOptions'
import { useSellingPolicy } from '@/features/selling/useSellingPolicy'

const PAGE_SIZE = 25

/**
 * 'MOVES': moves between the branch's areas (V63), its own list - a move is not a ledger row. 'REQUESTS': what one
 * area asked another for (Part 5), its own list too.
 */
type DirectionFilter = 'all' | MovementType | 'MOVES' | 'REQUESTS'

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
  TRANSFER_OUT: { label: 'Sent', variant: 'neutral' },
  TRANSFER_IN: { label: 'Received', variant: 'neutral' },
  MOVE: { label: 'Moved', variant: 'neutral' },
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
    if (searchParams.get('moves') === '1') return 'MOVES'
    if (searchParams.get('requests') === '1') return 'REQUESTS'
    const requested = searchParams.get('movementType')
    return requested === 'IN' || requested === 'OUT' || requested === 'ADJUSTMENT' ? requested : 'all'
  })
  const [companyVendorId, setCompanyVendorId] = useState('')
  /** '' any reason, 'NONE' no reason given, else one reason. Only asked once "Stock out" is chosen. */
  const [reasonFilter, setReasonFilter] = useState<'' | 'NONE' | OutReason>('')
  const [page, setPage] = useState(0)
  const reasonApplies = direction === 'OUT'
  // "Adjustments" is stock written off - counts and damaged, expired or lost stock-outs - not the
  // ledger's ADJUSTMENT type, which also holds fixes to sales.
  const showingAdjustments = direction === 'ADJUSTMENT'
  const { recordsSales, requiresSellingPrice } = useSellingPolicy()
  // "All branches" (MULTI_BRANCH_UX_PLAN.md §4.3): every branch's rows, each saying where.
  const branch = useOptionalWorkingBranch()
  const canManageInventory = permissions.includes(PERMISSIONS.MANAGE_INVENTORY)
  const showBranch = (branch?.isMultiBranch ?? false) && (branch?.isAll ?? false)
  const nameOf = (id: string | undefined) => branch?.nameOf(id)
  // …and a filter to one of them (UX §5.1).
  const [branchFilter, setBranchFilter] = useState('')
  const filteredBranch = showBranch && branchFilter ? branchFilter : undefined
  // Areas (V60): at a branch with areas, each row says which, and the moves between them are a choice.
  const areaBranch = branch?.working && hasAreas(branch.working) ? branch.working : null
  const areaName = (id: string | undefined) => areaBranch?.areas?.find((area) => area.id === id)?.name
  // The one area chosen at the top, if any: Step 6's line is that area's.
  const work = useWorkArea(areaBranch)
  const directions = areaBranch
    ? [...DIRECTIONS, { value: 'MOVES' as const, label: 'Moves between areas' }, { value: 'REQUESTS' as const, label: 'Requests' }]
    : DIRECTIONS
  // A list of its own (moves, or requests) instead of the ledger's rows.
  const showingMoves = (direction === 'MOVES' || direction === 'REQUESTS') && areaBranch != null

  const { vendors } = useVendorOptions(canViewVendors)

  const filters = {
    from: toApiDateTime(range.from),
    to: toApiDateTime(range.to),
    movementType: direction === 'all' || direction === 'MOVES' || direction === 'REQUESTS' || showingAdjustments ? undefined : direction,
    adjustments: showingAdjustments ? true : undefined,
    companyVendorId: companyVendorId || undefined,
    outReason: reasonApplies && reasonFilter && reasonFilter !== 'NONE' ? reasonFilter : undefined,
    noReason: reasonApplies && reasonFilter === 'NONE' ? true : undefined,
    ...(filteredBranch ? { branchId: filteredBranch } : {}),
  }
  const { movements, totalPages, totalElements, summary, loading, error, refetch } = useStockMovementReport({
    ...filters,
    page,
    size: PAGE_SIZE,
  })
  const { showToast } = useToast()
  const [exporting, setExporting] = useState(false)
  async function exportIt() {
    setExporting(true)
    try {
      downloadBlob(await stockMovementsApi.export(filters), 'stock-movements.xlsx')
    } catch {
      showToast("Couldn't download the movements. Try again.", 'error')
    } finally {
      setExporting(false)
    }
  }

  const rangeLabel = formatDateRange(range.from, range.to)
  const showSkeleton = loading && movements.length === 0

  /** Any filter change resets to the first page — page 4 of the old filter means nothing here. */
  function applyFilter(change: () => void) {
    change()
    setPage(0)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-neutral-900 lg:text-2xl">Stock movements</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">
            Everything you took in and gave out, with what it cost.
            <span className="hidden sm:inline">
              {' '}Dates are when the delivery or sale happened — not when it was entered — so backdated and imported stock
              lands in the period it really belongs to.
            </span>
          </p>
        </div>
        {/* The download is the ledger's: the moves list (newest first) has none. On a phone, its picture alone. */}
        {!showingMoves && (
          <Button variant="secondary" onClick={() => void exportIt()} loading={exporting} aria-label="Download">
            <Download className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Download</span>
          </Button>
        )}
      </div>

      {/* Every filter in one row under the title (owner, 2026-11-17): the figures, the area's line and the list below
          all follow them. Each choice says what it is ("This month", "Everything", "Any supplier"), so no labels show. */}
      {/* A phone: the period on its own line, the other two side by side under it - whole words, never cut. */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center" data-movement-filters>
        {!showingMoves && (
          <div className="col-span-2 sm:col-span-1">
            <DateRangeControl value={range} onChange={(next) => applyFilter(() => setRange(next))} />
          </div>
        )}
        <div className="min-w-0">
          <label htmlFor="direction" className="sr-only">
            Show
          </label>
          <select
            id="direction"
            value={direction}
            onChange={(event) => applyFilter(() => setDirection(event.target.value as DirectionFilter))}
            className="w-full min-w-0 rounded-md border border-neutral-300 px-2 py-2 text-sm text-neutral-900 sm:w-auto sm:px-3 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {directions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Only once "Stock out" is chosen: a reason is a fact about stock-outs, and offering it
            beside "Everything" would be a filter that quietly hides every delivery. */}
        {reasonApplies && (
          <div className="min-w-0">
            <label htmlFor="reason" className="sr-only">
              Reason
            </label>
            <select
              id="reason"
              value={reasonFilter}
              onChange={(event) => applyFilter(() => setReasonFilter(event.target.value as '' | 'NONE' | OutReason))}
              className="w-full min-w-0 rounded-md border border-neutral-300 px-2 py-2 text-sm text-neutral-900 sm:w-auto sm:px-3 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Any reason</option>
              {OUT_REASONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              <option value="NONE">{NO_REASON_LABEL}</option>
            </select>
          </div>
        )}

        {showBranch && branch && (
          <div className="min-w-0">
            <label htmlFor="movement-branch" className="sr-only">
              Branch
            </label>
            <select
              id="movement-branch"
              value={branchFilter}
              onChange={(event) => applyFilter(() => setBranchFilter(event.target.value))}
              className="w-full min-w-0 rounded-md border border-neutral-300 px-2 py-2 text-sm text-neutral-900 sm:w-auto sm:px-3 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Every branch</option>
              {branch.branches.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Hidden rather than disabled for a user without VIEW_VENDORS: the options would be a
            request they are not allowed to make, and an empty picker looks broken. */}
        {canViewVendors && !showingMoves && (
          <div className="min-w-0">
            <label htmlFor="supplier" className="sr-only">
              Supplier
            </label>
            <select
              id="supplier"
              value={companyVendorId}
              onChange={(event) => applyFilter(() => setCompanyVendorId(event.target.value))}
              className="w-full min-w-0 rounded-md border border-neutral-300 px-2 py-2 text-sm text-neutral-900 sm:w-auto sm:px-3 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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

      </div>

      {summary && showingAdjustments && !showingMoves && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Written off"
              value={formatCurrency(summary.writtenOffCost ?? 0)}
              subtitle={`${formatNumber(summary.writtenOffQuantity ?? 0)} units · ${rangeLabel}`}
              icon={SlidersHorizontal}
            />
          </div>
          <p className="text-sm text-neutral-600" data-adjustments-note>
            Counts that found less than the records, and stock given out as damaged, expired or lost, at what it cost. A
            count that found more is taken off.
            {(summary.writtenOffUnpricedCount ?? 0) > 0 && (
              <>
                {' '}
                {formatNumber(summary.writtenOffUnpricedCount ?? 0)}{' '}
                {summary.writtenOffUnpricedCount === 1 ? 'entry has' : 'entries have'} no cost, so the total leaves{' '}
                {summary.writtenOffUnpricedCount === 1 ? 'it' : 'them'} out.
              </>
            )}
          </p>
        </div>
      )}

      {/* A phone: the same four figures in one small block, so the list starts on the first screen (owner, 2026-11-17). */}
      {summary && !showingAdjustments && !showingMoves && (
        <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-neutral-200 bg-white tabular-nums sm:hidden" data-figures-compact>
          {[
            ['Stock in value', formatCurrency(summary.inValue)],
            ['Stock out value', formatCurrency(recordsSales && summary.salesAmount != null ? summary.salesAmount + summary.otherOutCost : summary.outValue)],
            ['Units in', formatNumber(summary.inQuantity)],
            ['Units out', formatNumber(summary.outQuantity)],
          ].map(([label, value], index) => (
            <div key={label} className={`px-3 py-2.5 ${index % 2 === 0 ? 'border-r' : ''} ${index < 2 ? 'border-b' : ''} border-neutral-200`}>
              <dt className="text-xs text-neutral-500">{label}</dt>
              <dd className="text-base font-semibold text-neutral-900">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {summary && !showingAdjustments && !showingMoves && (
        <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Stock in value"
            value={formatCurrency(summary.inValue)}
            subtitle={`${formatNumber(summary.inMovementCount)} deliveries · ${rangeLabel}`}
            icon={PackagePlus}
          />
          {/* §6.9: with selling on, the card keeps its place and splits in two - what sales went
              for, and every other stock-out at what it cost. The two add up to the figure. */}
          {recordsSales && summary.salesAmount != null ? (
            <StatCard
              label="Stock out value"
              value={formatCurrency(summary.salesAmount + summary.otherOutCost)}
              subtitle={`${formatCurrency(summary.salesAmount)} sales · ${formatCurrency(summary.otherOutCost)} other stock out`}
              icon={PackageMinus}
            />
          ) : (
            <StatCard
              label="Stock out value"
              value={formatCurrency(summary.outValue)}
              subtitle={`${formatNumber(summary.outMovementCount)} issues · ${rangeLabel}`}
              icon={PackageMinus}
            />
          )}
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

      {/* Step 6: an area that makes what is sold - what the plates took, and what counts found used on top. Managers
          only, and only when one area is chosen. */}
      {!showingMoves && canManageInventory && areaBranch && work.area && (
        <AreaUseLine branchId={areaBranch.id} areaId={work.area.id} range={range} rangeLabel={rangeLabel} />
      )}

      {/* Multiple branches (MULTI_BRANCH_BUILD_PLAN.md §4.3): at one branch, stock moved to and from the
          others is its own line - never folded into units in or out, which stay purchases and issues. */}
      {summary && !showingMoves && ((summary.movedInCount ?? 0) > 0 || (summary.movedOutCount ?? 0) > 0) && (
        <p className="text-sm text-neutral-600" data-moved-between-branches>
          Moved between branches: {formatNumber(summary.movedInQuantity ?? 0)} in from other branches ·{' '}
          {formatNumber(summary.movedOutQuantity ?? 0)} out to other branches. Not counted in units in or out.
        </p>
      )}

      {/* The one thing that makes the two numbers above reconcilable. Without it, a large "units
          in" against a smaller "stock in value" reads as a bug rather than as deliveries whose
          price nobody recorded. Shown only when there is actually a gap to explain. */}
      {summary &&
        !showingAdjustments &&
        !showingMoves &&
        (summary.unpricedInCount > 0 ||
          (requiresSellingPrice && summary.unpricedOutCount > 0) ||
          (summary.unpricedSaleCount ?? 0) > 0 ||
          summary.adjustmentCount > 0) && (
        <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          {summary.unpricedInCount > 0 && (
            <>
              {formatNumber(summary.unpricedInCount)} deliveries in this range have no price recorded,
              so their units are counted but their value is not.{' '}
            </>
          )}
          {/* A stock-out with no price is ordinary - used, spoilt, sent away - so only a sale's
              missing price is a gap worth saying (a marketplace seller's every stock-out is one). */}
          {requiresSellingPrice && summary.unpricedOutCount > 0 && (
            <>{formatNumber(summary.unpricedOutCount)} stock-outs have no price recorded. </>
          )}
          {!requiresSellingPrice && (summary.unpricedSaleCount ?? 0) > 0 && (
            <>
              {formatNumber(summary.unpricedSaleCount ?? 0)} {summary.unpricedSaleCount === 1 ? 'sale has' : 'sales have'} no price.{' '}
            </>
          )}
          {summary.adjustmentCount > 0 && (
            <>
              {recordsSales ? (
                // A cancelled sale and a price added later are adjustments too - and already in the
                // sales figure above - so the stock-take explanation alone would be wrong for them.
                <>
                  {formatNumber(summary.adjustmentCount)} adjustments (counts, and fixes to sales) are listed but not
                  counted as stock in or out.
                </>
              ) : (
                <>
                  {formatNumber(summary.adjustmentCount)} adjustments are listed but counted in neither
                  total — a stock-take correction is not a purchase or a sale.
                </>
              )}
            </>
          )}
        </p>
      )}

      {showingMoves && areaBranch && (direction === 'REQUESTS' ? <RequestsList branchId={areaBranch.id} /> : <MovesList branchId={areaBranch.id} />)}

      {!showingMoves && error && (
        <ErrorState
          variant={movements.length > 0 ? 'inline' : 'block'}
          title="We could not load stock movements"
          message={error}
          onRetry={refetch}
        />
      )}

      {!showingMoves && showSkeleton && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-md" />
          ))}
        </div>
      )}

      {!showingMoves && !showSkeleton && !error && movements.length === 0 && (
        <EmptyState
          icon={SlidersHorizontal}
          title="Nothing moved in this period"
          description="No stock came in or went out between these dates. Try a wider range, or clear the filters."
        />
      )}

      {!showingMoves && !showSkeleton && !error && (
        <p className="-mb-3 text-sm text-neutral-500">
          {formatNumber(totalElements)} movement{totalElements === 1 ? '' : 's'}
        </p>
      )}

      {!showingMoves && movements.length > 0 && (
        <>
          {/* A phone: one readable row per movement - product and quantity, then type, area and time, then the note. */}
          <ul className={`flex flex-col gap-2 md:hidden ${loading ? 'opacity-50' : ''}`} aria-label="Stock movements" data-movement-rows>
            {movements.map((movement) => {
              const badge = MOVEMENT_BADGE[movement.movementType]
              const out = movement.movementType === 'OUT' || movement.movementType === 'TRANSFER_OUT' || (movement.movementType === 'ADJUSTMENT' && movement.quantity < 0)
              const where = movement.movementType === 'MOVE' ? routeOf(movement) : areaBranch ? areaName(movement.areaId) : undefined
              return (
                <li key={movement.id} className="flex flex-col gap-0.5 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate font-medium text-neutral-900">{movement.productName ?? '—'}</span>
                    <span className={`shrink-0 font-semibold tabular-nums ${out ? 'text-warning-700' : 'text-accent-700'}`}>
                      {movement.movementType === 'ADJUSTMENT' || movement.movementType === 'MOVE' ? '' : out ? '−' : '+'}
                      {formatNumber(Math.abs(movement.quantity))}
                      {movement.unitOfMeasure && <span className="ml-1 text-xs font-normal text-neutral-500">{movement.unitOfMeasure.toLowerCase()}</span>}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-neutral-600">
                    <Badge variant={badge.variant}>{movement.outReason ? outReasonLabel(movement.outReason) : badge.label}</Badge>
                    {movement.count && <span>count ·</span>}
                    {where && <span>{where} ·</span>}
                    {showBranch && <span>{nameOf(movement.branchId) ?? '—'} ·</span>}
                    <span>{formatDateTime(movement.occurredAt ?? movement.createdAt)}</span>
                    {movement.lineValue != null && <span>· {formatCurrency(movement.lineValue)}</span>}
                  </div>
                  {(movement.note || movement.companyVendorName) && (
                    <p className="text-xs text-neutral-500">
                      {[movement.companyVendorName, movement.note].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
          {/* The table scrolls inside its own container rather than the page — eight columns do
              not fit a phone, and a horizontally scrolling page loses the nav. */}
          {/* Focusable, so the columns past the edge can be reached with a keyboard as well as a finger. */}
          <div
            tabIndex={0}
            role="region"
            aria-label="Stock movements"
            className={`hidden overflow-x-auto rounded-lg border border-neutral-200 bg-white transition-opacity md:block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${loading ? 'opacity-50' : ''}`}
          >
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Date</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Product</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Type</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Quantity</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Unit price</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Value</th>
                  {showBranch && <th scope="col" className="px-4 py-2.5 font-medium">Branch</th>}
                  {areaBranch && <th scope="col" className="px-4 py-2.5 font-medium">Area</th>}
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
                          <span className="mt-0.5 block font-mono text-xs text-neutral-500">
                            {movement.productSku}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                        {/* Why it went out, under the badge rather than in a ninth column. */}
                        {movement.outReason && (
                          <span className="mt-1 block text-xs text-neutral-600">
                            {outReasonLabel(movement.outReason)}
                            {movement.usedAreaId && areaName(movement.usedAreaId) ? ` at ${areaName(movement.usedAreaId)}` : ''}
                            {/* A kitchen's count found it short (Part 3.5): used there, learned from the count. */}
                            {movement.count && !movement.usedAreaId && areaName(movement.areaId) ? ` at ${areaName(movement.areaId)}` : ''}
                            {movement.count ? ' · count' : ''}
                          </span>
                        )}
                        {/* Where a move went, here when there is no Area column to say it (every branch). */}
                        {movement.movementType === 'MOVE' && !areaBranch && (
                          <span className="mt-1 block text-xs text-neutral-600">{routeOf(movement)}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-neutral-900">
                        {formatNumber(movement.quantity)}
                        {movement.unitOfMeasure && (
                          <span className="ml-1 text-xs text-neutral-500">{movement.unitOfMeasure}</span>
                        )}
                      </td>
                      {/* Em dash, never ₦0.00 — "no price recorded" is not "it was free". */}
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-neutral-600">
                        {movement.unitPriceAtTime == null ? '—' : formatCurrency(movement.unitPriceAtTime)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-medium text-neutral-900">
                        {movement.lineValue == null ? '—' : formatCurrency(movement.lineValue)}
                      </td>
                      {showBranch && <td className="px-4 py-3 text-neutral-600">{nameOf(movement.branchId) ?? '—'}</td>}
                      {areaBranch && (
                        <td className="whitespace-nowrap px-4 py-3 text-neutral-600">
                          {movement.movementType === 'MOVE' ? routeOf(movement) : (areaName(movement.areaId) ?? '—')}
                        </td>
                      )}
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

/** A move's two areas: "Store → Kitchen". */
function routeOf(movement: StockMovement): string {
  return `${movement.areaName ?? '—'} → ${movement.toAreaName ?? '—'}`
}
