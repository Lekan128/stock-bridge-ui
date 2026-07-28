import { Link } from 'react-router-dom'
import { LineChart, ShoppingBag } from 'lucide-react'
import { buttonClassName } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { ChartCard } from '@/components/analytics/ChartCard'
import { DateRangeControl } from '@/components/analytics/DateRangeControl'
import { SummaryCardsSkeleton } from '@/components/analytics/SummaryCardsSkeleton'
import { granularityForRange, toApiDateTime } from '@/components/analytics/dateRange'
import { formatDateRange } from '@/components/analytics/formatters'
import { AnalyticsErrorState } from '@/features/marketplace/analytics/components/AnalyticsErrorState'
import { CategoryMixChart } from '@/features/marketplace/analytics/components/CategoryMixChart'
import { FulfilmentFunnelPanel } from '@/features/marketplace/analytics/components/FulfilmentFunnelPanel'
import { RevenueChart } from '@/features/marketplace/analytics/components/RevenueChart'
import { SegmentedControl } from '@/features/marketplace/analytics/components/SegmentedControl'
import { SummaryCards } from '@/features/marketplace/analytics/components/SummaryCards'
import { TopCustomersPanel } from '@/features/marketplace/analytics/components/TopCustomersPanel'
import { TopProductsPanel } from '@/features/marketplace/analytics/components/TopProductsPanel'
import { useAnalyticsUrlState } from '@/features/marketplace/analytics/hooks/useAnalyticsUrlState'
import { useCategoryMix } from '@/features/marketplace/analytics/hooks/useCategoryMix'
import { useFulfilmentFunnel } from '@/features/marketplace/analytics/hooks/useFulfilmentFunnel'
import { useMarketplaceSummary } from '@/features/marketplace/analytics/hooks/useMarketplaceSummary'
import { useRevenueOverTime } from '@/features/marketplace/analytics/hooks/useRevenueOverTime'
import { useTopCustomers } from '@/features/marketplace/analytics/hooks/useTopCustomers'
import { useTopSellingProducts } from '@/features/marketplace/analytics/hooks/useTopSellingProducts'
import type { Granularity } from '@/features/marketplace/analytics/types'

const RANKING_LIMIT = 8
const MS_PER_DAY = 86_400_000

/**
 * ProcurePal marketplace analytics — route `/app/marketplace/analytics`, already behind
 * `RequirePlatformOwner` and the VIEW_MARKETPLACE_ANALYTICS permission.
 *
 * Composed the way `DashboardAnalytics` is — a header carrying the DateRangeControl, then
 * a stat grid, then ChartCards down the page — so the two analytics screens read as one
 * product. What differs is what a MARKETPLACE operator needs and a single tenant does not:
 * period-over-period deltas on every headline, a customer ranking, and the fulfilment
 * funnel with its hop durations, which is the only figure here that says where ops is slow.
 *
 * <h2>Six requests, six independent panels</h2>
 * Each endpoint has its own hook, skeleton, empty state and retry. One failing panel must
 * not blank the other five, and the granularity toggle must not re-fetch the customer
 * ranking. Loaded data is kept across a range change and dimmed rather than replaced by a
 * skeleton, so moving the dates does not make the whole page strobe.
 *
 * <h2>The zero state</h2>
 * A brand-new marketplace has no orders at all, and that must look intentional. When
 * nothing happened in this period AND nothing happened in the one before it, the page
 * swaps to a designed empty state that says what is missing and points at the two screens
 * that change it — rather than rendering ten cards of ₦0 above five empty charts.
 */
export function MarketplaceAnalyticsPage() {
  const {
    range,
    granularity,
    customerMetric,
    productMetric,
    setRange,
    setGranularity,
    setCustomerMetric,
    setProductMetric,
  } = useAnalyticsUrlState()

  const params = { from: toApiDateTime(range.from), to: toApiDateTime(range.to) }
  const rangeLabel = formatDateRange(range.from, range.to)
  const rangeDays = Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / MS_PER_DAY))

  const summary = useMarketplaceSummary(params)
  const revenue = useRevenueOverTime({ ...params, granularity })
  const customers = useTopCustomers({ ...params, metric: customerMetric, limit: RANKING_LIMIT })
  const products = useTopSellingProducts({ ...params, metric: productMetric, limit: RANKING_LIMIT })
  const categories = useCategoryMix(params)
  const funnel = useFulfilmentFunnel(params)

  // Nothing now and nothing before: a marketplace that has not traded, rather than a quiet
  // month. A quiet month still gets the full screen — "₦0 in March against ₦4m in
  // February" is itself the finding, and hiding it behind an empty state would bury it.
  const neverTraded =
    summary.data != null &&
    summary.data.current.orderCount === 0 &&
    summary.data.previous.orderCount === 0 &&
    summary.data.current.cancelledOrderCount === 0 &&
    summary.data.current.abandonedCheckoutCount === 0

  const refreshing = summary.loading && summary.data != null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Marketplace analytics</h1>
          <p className="text-sm text-neutral-500">
            Revenue, customers and fulfilment across every company buying from ProcurePal.
          </p>
        </div>
        <DateRangeControl value={range} onChange={setRange} />
      </div>

      {/* The definitions, once and in plain words. A number whose definition the reader has
          to guess at is worse than no number, and "revenue" is the one everybody assumes
          they already understand. */}
      <p className="text-xs leading-relaxed text-neutral-500">
        {rangeLabel} · Revenue counts every order placed in this period except cancelled ones and checkouts that were
        never paid for. Deltas compare against the {rangeDays} day{rangeDays === 1 ? '' : 's'} immediately before it.
      </p>

      {summary.error && !summary.data && (
        <AnalyticsErrorState variant="banner" message={summary.error} onRetry={summary.refetch} />
      )}

      {summary.loading && !summary.data && <SummaryCardsSkeleton count={9} />}

      {neverTraded ? (
        <EmptyState
          icon={ShoppingBag}
          title="No orders yet"
          description="Once companies start buying from the marketplace, this is where revenue, your best customers, what is selling and how fast you are fulfilling will appear."
          action={
            <>
              <Link to="/app/marketplace/products" className={buttonClassName('primary')}>
                Manage listings
              </Link>
              <Link to="/app/marketplace/orders" className={buttonClassName('secondary')}>
                Open fulfilment queue
              </Link>
            </>
          }
        />
      ) : (
        <>
          {summary.data && (
            <div className={refreshing ? 'opacity-60 transition-opacity' : 'transition-opacity'} aria-busy={refreshing}>
              <SummaryCards summary={summary.data} />
            </div>
          )}

          <ChartCard
            title="Revenue over time"
            subtitle="Bars are revenue; the dashed area is order count, rescaled to share the axis"
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <SegmentedControl<Granularity>
                  label="Bucket size"
                  value={granularity}
                  onChange={setGranularity}
                  options={[
                    { value: 'DAY', label: 'Daily' },
                    { value: 'WEEK', label: 'Weekly' },
                    { value: 'MONTH', label: 'Monthly' },
                  ]}
                />
                {/* The dashboard derives granularity from the range length; here it is the
                    operator's choice, so the same rule is offered as advice, not applied. */}
                <span className="text-xs text-neutral-500">
                  Suggested for this range: {granularityForRange(range.from, range.to).toUpperCase()}
                </span>
              </div>
              <RevenueChart
                data={revenue.data}
                loading={revenue.loading}
                error={revenue.error}
                onRetry={revenue.refetch}
                granularity={granularity}
              />
            </div>
          </ChartCard>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ChartCard title="Top customers" subtitle="Ranked by what they spent or how often they ordered">
              <TopCustomersPanel
                data={customers.data}
                loading={customers.loading}
                error={customers.error}
                onRetry={customers.refetch}
                metric={customerMetric}
                onMetricChange={setCustomerMetric}
              />
            </ChartCard>

            <ChartCard title="Top products" subtitle="Goods revenue only — a delivery fee belongs to no product">
              <TopProductsPanel
                data={products.data}
                loading={products.loading}
                error={products.error}
                onRetry={products.refetch}
                metric={productMetric}
                onMetricChange={setProductMetric}
              />
            </ChartCard>
          </div>

          <ChartCard title="Category mix" subtitle="Share of goods revenue by catalog category">
            <CategoryMixChart
              data={categories.data}
              loading={categories.loading}
              error={categories.error}
              onRetry={categories.refetch}
            />
          </ChartCard>

          <ChartCard
            title="Fulfilment funnel"
            subtitle="Where orders got to, where they are now, and how long each step takes"
          >
            <FulfilmentFunnelPanel
              data={funnel.data}
              loading={funnel.loading}
              error={funnel.error}
              onRetry={funnel.refetch}
            />
          </ChartCard>

          {/* A quiet period keeps the full screen but says so, so an operator does not read
              five empty charts as a page that failed to load. */}
          {summary.data?.current.orderCount === 0 && (
            <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-6 text-center text-sm text-neutral-500">
              <LineChart className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
              No orders were placed in {rangeLabel}. Try a wider date range.
            </p>
          )}
        </>
      )}
    </div>
  )
}
