import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { ChartCard } from '@/components/analytics/ChartCard'
import { DateRangeControl } from '@/components/analytics/DateRangeControl'
import {
  defaultDateRange,
  granularityForRange,
  toApiDateTime,
  type DateRange,
} from '@/components/analytics/dateRange'
import { formatCompactCurrency, formatDateRange, formatNumber } from '@/components/analytics/formatters'
import { MovementsChart } from '@/components/analytics/MovementsChart'
import { TopProductsChart } from '@/components/analytics/TopProductsChart'
import type { TopProductsDirection, TopProductsMetric } from '@/components/analytics/types'
import { useAnalyticsSummary } from '@/features/analytics/hooks/useAnalyticsSummary'
import { useMovementsOverTime } from '@/features/analytics/hooks/useMovementsOverTime'
import { useTopProducts } from '@/features/analytics/hooks/useTopProducts'

const TOP_PRODUCTS_LIMIT = 8

/**
 * The movements half of the dashboard (C5): one chart of value in and out, its legend carrying the
 * totals the four old cards did, and top products. Mounted only for users with VIEW_ANALYTICS so
 * the analytics hooks never fire (and never 403) for anyone else.
 */
export function DashboardAnalytics() {
  const { user } = useAuth()
  const [range, setRange] = useState<DateRange>(defaultDateRange)
  const [metric, setMetric] = useState<TopProductsMetric>('value')
  const [direction, setDirection] = useState<TopProductsDirection>('in')

  const params = { from: toApiDateTime(range.from), to: toApiDateTime(range.to) }
  const granularity = granularityForRange(range.from, range.to)
  const rangeLabel = formatDateRange(range.from, range.to)
  /**
   * Gates the drill-through on the four movement cards. MANAGE_INVENTORY because that is what the
   * report itself requires — linking somebody to a 403 is worse than not linking them.
   *
   * The link carries this card's own date range, so the rows a user lands on are the rows behind
   * the number they just clicked. Both sides bracket `occurredAt` server-side, so the total on
   * the card and the total on the report agree.
   */
  const canViewMovements = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.MANAGE_INVENTORY)
  const movementsHref = (movementType?: 'IN' | 'OUT') => {
    if (!canViewMovements) return undefined
    const query = new URLSearchParams({ from: params.from, to: params.to })
    if (movementType) query.set('movementType', movementType)
    return `/app/stock-movements?${query.toString()}`
  }

  const summary = useAnalyticsSummary(params)
  const {
    data: movements,
    loading: movementsLoading,
    error: movementsError,
  } = useMovementsOverTime({ ...params, granularity })
  const {
    data: topProducts,
    loading: topProductsLoading,
    error: topProductsError,
  } = useTopProducts({ ...params, by: metric, direction, limit: TOP_PRODUCTS_LIMIT })

  // Pattern C: the figures say when they were true — and that they are the saved copy, offline.
  const asOf =
    summary.updatedAt != null
      ? `${summary.showingSaved ? 'Offline · ' : ''}as of ${new Date(summary.updatedAt).toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        })}`
      : null

  return (
    <section aria-labelledby="movements-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="movements-heading" className="text-base font-semibold text-neutral-900">
            Stock movements
          </h2>
          <p className="text-sm text-neutral-500">
            {rangeLabel}
            {asOf && <span data-as-of> · {asOf}</span>}
          </p>
        </div>
        <DateRangeControl value={range} onChange={setRange} />
      </div>

      {/* One chart; the four in/out cards it replaces are its legend now (C5, U7). Each total
          links to the report behind it, for the same dates. */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        {summary.error && !summary.data ? (
          <p className="text-sm text-danger-700">{summary.error}</p>
        ) : (
          <dl className="mb-4 flex flex-wrap gap-x-8 gap-y-3" data-legend>
            <LegendTotal
              label="In"
              swatch="bg-primary-500"
              value={summary.data ? formatCompactCurrency(summary.data.totalInValue) : '…'}
              units={summary.data ? `${formatNumber(summary.data.totalUnitsIn)} units` : ''}
              href={movementsHref('IN')}
            />
            <LegendTotal
              label="Out"
              swatch="bg-accent-600"
              value={summary.data ? formatCompactCurrency(summary.data.totalOutValue) : '…'}
              units={summary.data ? `${formatNumber(summary.data.totalUnitsOut)} units` : ''}
              href={movementsHref('OUT')}
            />
          </dl>
        )}
        <MovementsChart data={movements} loading={movementsLoading} error={movementsError} granularity={granularity} showLegend={false} />
      </div>

      <ChartCard title="Top products" subtitle="Ranked by value or quantity, in or out">
        <TopProductsChart
          data={topProducts}
          loading={topProductsLoading}
          error={topProductsError}
          metric={metric}
          onMetricChange={setMetric}
          direction={direction}
          onDirectionChange={setDirection}
        />
      </ChartCard>
    </section>
  )
}

function LegendTotal({
  label,
  swatch,
  value,
  units,
  href,
}: {
  label: string
  swatch: string
  value: string
  units: string
  href?: string
}) {
  const figures = (
    <>
      <span className="text-xl font-semibold text-neutral-900">{value}</span>
      <span className="text-sm text-neutral-500">{units}</span>
    </>
  )
  // The link sits inside the <dd>: a <dl> may only hold <div>-wrapped <dt>/<dd> pairs, so a link
  // around the pair hid it from assistive tech as a list (Phase H accessibility audit).
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
        {/* The chart's own series colours (chartTokens): in navy, out green. */}
        <span className={`h-2.5 w-2.5 rounded-sm ${swatch}`} aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-0.5">
        {href ? (
          <Link
            to={href}
            className="flex items-baseline gap-2 rounded-sm tabular-nums hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            {figures}
          </Link>
        ) : (
          <span className="flex items-baseline gap-2 tabular-nums">{figures}</span>
        )}
      </dd>
    </div>
  )
}
