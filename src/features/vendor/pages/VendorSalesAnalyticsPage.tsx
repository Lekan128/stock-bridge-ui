import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Banknote, ClipboardList, HandCoins, PackageSearch, Receipt, TrendingUp } from 'lucide-react'
import { ChartCard } from '@/components/analytics/ChartCard'
import { DateRangeControl } from '@/components/analytics/DateRangeControl'
import { defaultDateRange, granularityForRange, toApiDateTime, type DateRange } from '@/components/analytics/dateRange'
import { formatDateRange, formatNumber } from '@/components/analytics/formatters'
import { SummaryCardsSkeleton } from '@/components/analytics/SummaryCardsSkeleton'
import { EmptyState } from '@/components/EmptyState'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import { AnalyticsErrorState } from '@/features/marketplace/analytics/components/AnalyticsErrorState'
import { MetricCard } from '@/features/marketplace/analytics/components/MetricCard'
import { SegmentedControl } from '@/features/marketplace/analytics/components/SegmentedControl'
import { VendorRevenueChart } from '@/features/vendor/components/VendorRevenueChart'
import {
  useVendorOrderStatusBreakdown,
  useVendorRevenueOverTime,
  useVendorSalesSummary,
  useVendorStockOuts,
  useVendorTopProducts,
} from '@/features/vendor/hooks/useVendorSales'
import type { Granularity, ProductMetric } from '@/features/vendor/types'
import { formatNaira } from '@/utils/money'

const TOP_PRODUCTS_LIMIT = 8
const STOCK_OUT_LIMIT = 8

/**
 * A seller's own sales — `/app/selling/analytics`.
 *
 * <h2>Own sales, and only own sales</h2>
 * Every figure on this page is scoped server-side to the caller's `seller_client_id`. There
 * is no customer ranking, no repeat-buyer rate and nothing about any other seller, here or in
 * the API behind it — that is the scope decision VENDOR_RESEARCH.md Section C item 7 forces,
 * and it is enforced in the repository layer rather than by this screen not asking.
 *
 * <h2>Who sees it</h2>
 * Vendors AND ProcurePal. The route is behind `RequireSeller`, not `RequireVendor`: the
 * platform owner sells too and has own-sales figures like anybody else — separate from its
 * marketplace-wide analytics, which cover every seller and stay where they are.
 *
 * <h2>Why local state rather than the URL</h2>
 * Unlike ProcurePal's marketplace analytics, which exist to be shared ("look at March"), this
 * is one account's private view of its own trading. There is nobody to send the link to — a
 * vendor has exactly one user — so `useState` matching the tenant dashboard is the right
 * weight, and the query string stays free for filters that mean something to a reader.
 */
export function VendorSalesAnalyticsPage() {
  const [range, setRange] = useState<DateRange>(defaultDateRange)
  const [granularity, setGranularity] = useState<Granularity | null>(null)
  const [productMetric, setProductMetric] = useState<ProductMetric>('REVENUE')

  const params = { from: toApiDateTime(range.from), to: toApiDateTime(range.to) }
  // The range picks a sensible bucket size until the reader overrides it; once they have,
  // their choice sticks across range changes rather than being silently reset.
  const effectiveGranularity: Granularity =
    granularity ?? (granularityForRange(range.from, range.to).toUpperCase() as Granularity)
  const rangeLabel = formatDateRange(range.from, range.to)

  const summary = useVendorSalesSummary(params)
  const revenue = useVendorRevenueOverTime({ ...params, granularity: effectiveGranularity })
  const topProducts = useVendorTopProducts({ ...params, metric: productMetric, limit: TOP_PRODUCTS_LIMIT })
  const statuses = useVendorOrderStatusBreakdown(params)
  const stockOuts = useVendorStockOuts(STOCK_OUT_LIMIT)

  const current = summary.data?.current
  const previous = summary.data?.previous
  const visibleStatuses = (statuses.data ?? []).filter((entry) => entry.orderCount > 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">My sales</h1>
          <p className="text-sm text-neutral-500">What you sold, what you are owed, and what has run out.</p>
        </div>
        <DateRangeControl value={range} onChange={setRange} />
      </div>

      {summary.loading && !summary.data && <SummaryCardsSkeleton />}
      {summary.error && !summary.data && <AnalyticsErrorState message={summary.error} onRetry={summary.refetch} />}

      {current && previous && (
        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 ${summary.loading ? 'opacity-60' : ''}`}>
          <MetricCard
            label="Revenue"
            value={formatNaira(current.grossRevenue)}
            icon={Banknote}
            current={current.grossRevenue}
            previous={previous.grossRevenue}
            hint="Goods and delivery, before commission"
          />
          <MetricCard
            label="Orders"
            value={formatNumber(current.orderCount)}
            icon={Receipt}
            current={current.orderCount}
            previous={previous.orderCount}
            hint={rangeLabel}
          />
          <MetricCard
            label="Average order"
            value={formatNaira(current.averageOrderValue)}
            icon={TrendingUp}
            current={current.averageOrderValue}
            previous={previous.averageOrderValue}
          />
          <MetricCard
            label="Awaiting fulfilment"
            value={formatNaira(current.outstandingOrderValue)}
            icon={ClipboardList}
            current={current.outstandingOrderCount}
            previous={previous.outstandingOrderCount}
            // A backlog going UP is the bad direction — a green arrow here would be actively
            // misleading. Same for the exposure card below it.
            higherIsBetter={false}
            hint={`${formatNumber(current.outstandingOrderCount)} orders still to deliver`}
            variant={current.outstandingOrderCount > 0 ? 'warning' : 'default'}
          />
          <MetricCard
            label="Cash on delivery owed"
            value={formatNaira(current.payOnDeliveryExposure)}
            icon={HandCoins}
            current={current.payOnDeliveryExposure}
            previous={previous.payOnDeliveryExposure}
            higherIsBetter={false}
            hint="Collected on your behalf, not yet settled"
          />
          <MetricCard
            label="Cancelled"
            value={formatNaira(current.cancelledOrderValue)}
            icon={AlertTriangle}
            current={current.cancelledOrderCount}
            previous={previous.cancelledOrderCount}
            higherIsBetter={false}
            hint={`${formatNumber(current.cancelledOrderCount)} orders — excluded from revenue`}
          />
        </div>
      )}

      <ChartCard title="Revenue over time" subtitle={rangeLabel}>
        <div className="mb-3 flex justify-end">
          <SegmentedControl<Granularity>
            label="Bucket size"
            value={effectiveGranularity}
            onChange={setGranularity}
            options={[
              { value: 'DAY', label: 'Day' },
              { value: 'WEEK', label: 'Week' },
              { value: 'MONTH', label: 'Month' },
            ]}
          />
        </div>
        <VendorRevenueChart
          data={revenue.data}
          loading={revenue.loading}
          error={revenue.error}
          onRetry={revenue.refetch}
          granularity={effectiveGranularity}
        />
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Your best sellers" subtitle={rangeLabel}>
          <div className="mb-3 flex justify-end">
            <SegmentedControl<ProductMetric>
              label="Rank products by"
              value={productMetric}
              onChange={setProductMetric}
              options={[
                { value: 'REVENUE', label: 'Revenue' },
                { value: 'QUANTITY', label: 'Units' },
              ]}
            />
          </div>
          {topProducts.error && !topProducts.data && (
            <AnalyticsErrorState message={topProducts.error} onRetry={topProducts.refetch} variant="banner" />
          )}
          {topProducts.data?.length === 0 && (
            <EmptyState icon={PackageSearch} title="Nothing sold in this period" />
          )}
          {topProducts.data && topProducts.data.length > 0 && (
            <ol className="flex flex-col divide-y divide-neutral-100">
              {topProducts.data.map((product) => (
                <li key={product.productId} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900">{product.name}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {product.sku} · {product.categoryName}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-neutral-900">
                      {productMetric === 'REVENUE' ? formatNaira(product.revenue) : formatNumber(product.quantitySold)}
                    </p>
                    <p className="text-xs tabular-nums text-neutral-500">
                      {productMetric === 'REVENUE'
                        ? `${formatNumber(product.quantitySold)} units`
                        : formatNaira(product.revenue)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </ChartCard>

        <ChartCard title="Where your orders are" subtitle="Cancelled and unpaid orders included">
          {statuses.error && !statuses.data && (
            <AnalyticsErrorState message={statuses.error} onRetry={statuses.refetch} variant="banner" />
          )}
          {statuses.data && visibleStatuses.length === 0 && (
            <EmptyState icon={ClipboardList} title="No orders in this period" />
          )}
          {visibleStatuses.length > 0 && (
            <ul className="flex flex-col divide-y divide-neutral-100">
              {visibleStatuses.map((entry) => (
                <li key={entry.status} className="flex items-center justify-between gap-3 py-2.5">
                  <OrderStatusBadge status={entry.status} />
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums text-neutral-900">
                      {formatNumber(entry.orderCount)}
                    </p>
                    <p className="text-xs tabular-nums text-neutral-500">{formatNaira(entry.orderValue)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>

      {/* Not a chart and not scoped to the date range: a stock-out is a fact about NOW, and it
          is on this page rather than on the inventory screen because it is the leading
          indicator of the cancellations two cards up. */}
      <ChartCard title="Out of stock or running low" subtitle="Right now, not for the period above">
        {stockOuts.error && !stockOuts.data && (
          <AnalyticsErrorState message={stockOuts.error} onRetry={stockOuts.refetch} variant="banner" />
        )}
        {stockOuts.data?.length === 0 && (
          <EmptyState icon={PackageSearch} title="Everything you list is in stock" tone="positive" />
        )}
        {stockOuts.data && stockOuts.data.length > 0 && (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {stockOuts.data.map((product) => (
              <li key={product.productId} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <Link
                    to={`/app/products/${product.productId}`}
                    className="truncate text-sm font-medium text-neutral-900 hover:underline"
                  >
                    {product.name}
                  </Link>
                  <p className="truncate text-xs text-neutral-500">
                    {product.sku}
                    {/* A LISTED product at zero is a buyer about to fail to order; an unlisted
                        one is a decision the seller already made. Only the first is urgent. */}
                    {product.listed ? ' · on the storefront' : ' · not listed'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`text-sm font-semibold tabular-nums ${
                      product.availableToSell === 0 ? 'text-danger-600' : 'text-warning-700'
                    }`}
                  >
                    {product.availableToSell} available
                  </p>
                  <p className="text-xs tabular-nums text-neutral-500">
                    {product.quantityOnHand} on hand · {product.committedQuantity} committed
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ChartCard>
    </div>
  )
}
