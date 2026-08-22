import { useEffect, useMemo, useState } from 'react'
import { Building2, ClipboardList, Coins, Package, Store, Wallet } from 'lucide-react'
import { ChartCard } from '@/components/analytics/ChartCard'
import { DateRangeControl } from '@/components/analytics/DateRangeControl'
import { defaultDateRange, granularityForRange, toApiDateTime, type DateRange } from '@/components/analytics/dateRange'
import { formatDateRange, formatNumber } from '@/components/analytics/formatters'
import { SummaryCardsSkeleton } from '@/components/analytics/SummaryCardsSkeleton'
import { PlatformRevenueChart, type ChartGranularity } from '@/features/admin/components/PlatformRevenueChart'
import { SellerRevenueTable } from '@/features/admin/components/SellerRevenueTable'
import {
  usePlatformRevenueOverTime,
  usePlatformRevenueSummary,
  useSellerRevenueBreakdown,
} from '@/features/admin/hooks/usePlatformRevenue'
import type {
  PlatformRevenueOrderStatus,
  PlatformRevenuePaymentStatus,
  PlatformRevenueParams,
  SellerRevenueEntry,
  SellerRevenueSort,
} from '@/features/admin/types'
import { MetricCard } from '@/features/marketplace/analytics/components/MetricCard'
import { SegmentedControl } from '@/features/marketplace/analytics/components/SegmentedControl'
import { statusLabel } from '@/features/marketplace/analytics/formatters'
import { formatNaira, formatNairaCompact } from '@/utils/money'

const ORDER_STATUSES: PlatformRevenueOrderStatus[] = [
  'PENDING_PAYMENT',
  'PLACED',
  'CONFIRMED',
  'PROCESSING',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'RECEIVED',
  'CANCELLED',
]

const PAYMENT_STATUSES: { value: PlatformRevenuePaymentStatus; label: string }[] = [
  { value: 'PENDING', label: 'Awaiting payment' },
  { value: 'PAID', label: 'Paid' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'ON_DELIVERY', label: 'Pay on delivery' },
  { value: 'REFUNDED', label: 'Refunded' },
]

const selectClassName =
  'rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none'

/**
 * Marketplace revenue across every seller — route `/admin/revenue`, behind `RequireSuperAdmin`.
 *
 * <h2>Why this screen exists</h2>
 * M6 narrowed ProcurePal's own analytics to ProcurePal's own sales, because the operator was
 * reading a revenue figure that included third-party vendors' money. That was the right fix
 * and it removed a number somebody legitimately needs — so the cross-seller total lives here,
 * on the super admin's side of the login, where "every seller's revenue" is a platform
 * operations question rather than one seller reading another's book.
 *
 * <h2>The one thing the page is arranged to answer</h2>
 * "How much of this is ours, and which vendors are growing." So ProcurePal is a ROW in the
 * table like any other seller, badged rather than netted off; every row carries its share of
 * the total and its change against the preceding window; and the table sorts by growth as
 * well as by size, because the biggest seller and the fastest-growing one are rarely the same
 * one and the second is the more actionable.
 *
 * <h2>Three requests, three independent panels</h2>
 * The bucket-size toggle must not re-request the seller table, and re-sorting the table must
 * not redraw the chart. Each panel keeps its last good data across a refetch and dims rather
 * than blanking, so scrubbing the date range does not make the page strobe. Same arrangement
 * as the marketplace analytics screen, for the same reasons.
 *
 * <h2>The seller filter's options, and why they come from the data</h2>
 * There is no "list every seller" call on this surface, and adding one would answer a
 * different question anyway: the useful dropdown is "sellers who traded in this period", not
 * "vendor accounts that exist". So the options are harvested from the UNFILTERED breakdown —
 * captured whenever no seller filter is applied and then held while one is, since applying the
 * filter necessarily narrows the response to a single row. The alternative, rebuilding the
 * list from the filtered response, would empty the dropdown the moment it was used.
 */
export function AdminMarketplaceRevenuePage() {
  const [range, setRange] = useState<DateRange>(defaultDateRange)
  const [granularity, setGranularity] = useState<ChartGranularity>('DAY')
  const [sellerId, setSellerId] = useState<string>('')
  const [status, setStatus] = useState<PlatformRevenueOrderStatus | ''>('')
  const [paymentStatus, setPaymentStatus] = useState<PlatformRevenuePaymentStatus | ''>('')
  const [sort, setSort] = useState<SellerRevenueSort>('REVENUE')
  const [ascending, setAscending] = useState<boolean | undefined>(undefined)
  const [sellerOptions, setSellerOptions] = useState<SellerRevenueEntry[]>([])

  // Omitted rather than sent empty: the API adds one SQL predicate per PRESENT filter, so an
  // empty string would bind as a value and match nothing.
  const filters: PlatformRevenueParams = useMemo(
    () => ({
      from: toApiDateTime(range.from),
      to: toApiDateTime(range.to),
      ...(sellerId ? { sellerId } : {}),
      ...(status ? { status } : {}),
      ...(paymentStatus ? { paymentStatus } : {}),
    }),
    [range, sellerId, status, paymentStatus],
  )

  const summary = usePlatformRevenueSummary(filters)
  const series = usePlatformRevenueOverTime({ ...filters, granularity })
  const breakdown = useSellerRevenueBreakdown({ ...filters, sort, ascending })

  // Held across a seller filter being applied — see the class doc.
  useEffect(() => {
    if (!sellerId && breakdown.data) {
      setSellerOptions(
        [...breakdown.data.sellers].sort((a, b) => a.name.localeCompare(b.name)),
      )
    }
  }, [sellerId, breakdown.data])

  const rangeLabel = formatDateRange(range.from, range.to)
  const current = summary.data?.current
  const previous = summary.data?.previous
  const filtered = Boolean(sellerId || status || paymentStatus)
  const refreshing = summary.loading && summary.data != null

  function handleSortChange(nextSort: SellerRevenueSort, nextAscending?: boolean) {
    setSort(nextSort)
    setAscending(nextAscending)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Marketplace Revenue</h1>
          <p className="text-sm text-neutral-500">
            Every seller's sales in one place — ProcurePal's and every vendor's — and how each is growing.
          </p>
        </div>
        <DateRangeControl value={range} onChange={setRange} />
      </div>

      {/* The definitions, once and in plain words. "Revenue" is the number everybody assumes
          they already understand, and this one means something different from the figure on
          ProcurePal's own screen — so the difference is stated rather than left to be
          discovered by subtracting them. */}
      <p className="text-xs leading-relaxed text-neutral-500">
        {rangeLabel} · Revenue is what the marketplace <span className="font-medium">booked</span> across all sellers —
        goods plus delivery, excluding cancelled orders and checkouts that were never paid for. It is not what the
        platform earns: commission is not modelled yet, and nothing here is netted off. ProcurePal's own screen shows
        only its own share of this. Growth compares against the period of equal length immediately before this one.
      </p>

      {/* Filters. Grouped together and above the numbers rather than inline with them, so a
          reader always knows the whole page is answering one question, not six. */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="revenue-seller" className="text-xs font-medium text-neutral-700">
            Seller
          </label>
          <select
            id="revenue-seller"
            value={sellerId}
            onChange={(event) => setSellerId(event.target.value)}
            className={selectClassName}
          >
            <option value="">All sellers</option>
            {sellerOptions.map((option) => (
              <option key={option.sellerClientId} value={option.sellerClientId}>
                {option.name}
                {option.platformOwner ? ' (ProcurePal)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="revenue-status" className="text-xs font-medium text-neutral-700">
            Order status
          </label>
          <select
            id="revenue-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as PlatformRevenueOrderStatus | '')}
            className={selectClassName}
          >
            <option value="">Any status</option>
            {ORDER_STATUSES.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="revenue-payment-status" className="text-xs font-medium text-neutral-700">
            Payment status
          </label>
          <select
            id="revenue-payment-status"
            value={paymentStatus}
            onChange={(event) => setPaymentStatus(event.target.value as PlatformRevenuePaymentStatus | '')}
            className={selectClassName}
          >
            <option value="">Any payment status</option>
            {PAYMENT_STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {filtered && (
          <button
            type="button"
            onClick={() => {
              setSellerId('')
              setStatus('')
              setPaymentStatus('')
            }}
            className="rounded-md px-3 py-2 text-sm font-medium text-primary-600 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Filtering to CANCELLED is legal and reports ₦0 revenue with a non-zero cancelled
          value, which is honest but surprising the first time. Said out loud rather than
          special-cased, because redefining "revenue" to match the filter would be worse. */}
      {status === 'CANCELLED' && (
        <p className="rounded-md border border-warning-200 bg-warning-50 px-4 py-2.5 text-sm text-warning-800">
          Cancelled orders carry no revenue by definition, so the revenue figures below read ₦0. The cancelled value
          card is the number to read with this filter on.
        </p>
      )}

      {summary.error && !summary.data && (
        <div className="rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {summary.error}
        </div>
      )}

      {summary.loading && !summary.data && <SummaryCardsSkeleton count={6} />}

      {current && previous && (
        <div
          className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 ${
            refreshing ? 'opacity-60 transition-opacity' : 'transition-opacity'
          }`}
          aria-busy={refreshing}
        >
          <MetricCard
            label="Marketplace revenue"
            value={formatNairaCompact(current.grossRevenue)}
            icon={Coins}
            current={current.grossRevenue}
            previous={previous.grossRevenue}
            hint={`${formatNaira(current.grossRevenue)} · ${formatNairaCompact(current.collectedRevenue)} collected`}
          />
          <MetricCard
            label="Orders"
            value={formatNumber(current.orderCount)}
            icon={ClipboardList}
            current={current.orderCount}
            previous={previous.orderCount}
            hint="Excludes cancelled and unpaid checkouts"
          />
          <MetricCard
            label="Average order value"
            value={formatNairaCompact(current.averageOrderValue)}
            icon={Wallet}
            current={current.averageOrderValue}
            previous={previous.averageOrderValue}
            hint={formatNaira(current.averageOrderValue)}
          />
          <MetricCard
            label="Sellers trading"
            value={formatNumber(current.sellingSellerCount)}
            icon={Store}
            current={current.sellingSellerCount}
            previous={previous.sellingSellerCount}
            hint="Took at least one order in this period — not the count of vendor accounts"
          />
          <MetricCard
            label="Buying companies"
            value={formatNumber(current.buyingCompanyCount)}
            icon={Building2}
            current={current.buyingCompanyCount}
            previous={previous.buyingCompanyCount}
            hint="Distinct across the whole marketplace, not the sum of the seller rows"
          />
          <MetricCard
            label="Units sold"
            value={formatNumber(current.unitsSold)}
            icon={Package}
            current={current.unitsSold}
            previous={previous.unitsSold}
            hint="Across mixed units of measure"
          />
        </div>
      )}

      <ChartCard
        title="Revenue over time"
        subtitle="Bars are revenue across every seller; the dashed area is order count, rescaled to share the axis"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl<ChartGranularity>
              label="Bucket size"
              value={granularity}
              onChange={setGranularity}
              options={[
                { value: 'DAY', label: 'Daily' },
                { value: 'WEEK', label: 'Weekly' },
                { value: 'MONTH', label: 'Monthly' },
              ]}
            />
            {/* Advice, not policy: the operator picked this range on purpose and may want a
                bucket size the heuristic would not choose. */}
            <span className="text-xs text-neutral-500">
              Suggested for this range: {granularityForRange(range.from, range.to).toUpperCase()}
            </span>
          </div>
          <PlatformRevenueChart
            data={series.data}
            loading={series.loading}
            error={series.error}
            onRetry={series.refetch}
            granularity={granularity}
          />
        </div>
      </ChartCard>

      <ChartCard
        title="Revenue by seller"
        subtitle={
          filtered
            ? 'Filtered — the total below is this selection, not the whole marketplace'
            : 'Every seller that traded in either period. Sort by growth to see who is moving.'
        }
      >
        {breakdown.error && !breakdown.data && (
          <div className="rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            {breakdown.error}
          </div>
        )}

        {breakdown.data && breakdown.data.sellers.length === 0 && (
          <p className="py-6 text-center text-sm text-neutral-500">No seller took an order in this period.</p>
        )}

        {breakdown.data && breakdown.data.sellers.length > 0 && (
          <div className={`flex flex-col gap-3 ${breakdown.loading ? 'opacity-60' : ''}`}>
            <div className="overflow-x-auto">
              <SellerRevenueTable
                entries={breakdown.data.sellers}
                sort={sort}
                ascending={ascending}
                onSortChange={handleSortChange}
              />
            </div>
            <p className="text-xs text-neutral-500">
              {formatNumber(breakdown.data.sellers.length)} seller
              {breakdown.data.sellers.length === 1 ? '' : 's'} · {formatNaira(breakdown.data.totalRevenue)} total ·{' '}
              {formatNaira(breakdown.data.previousTotalRevenue)} in the previous period
            </p>
          </div>
        )}
      </ChartCard>
    </div>
  )
}
