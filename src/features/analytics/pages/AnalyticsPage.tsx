import { useState } from 'react'
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, PackageCheck, PackageMinus, PackagePlus } from 'lucide-react'
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
import { StatCard } from '@/components/analytics/StatCard'
import { SummaryCardsSkeleton } from '@/components/analytics/SummaryCardsSkeleton'
import { TopProductsChart } from '@/components/analytics/TopProductsChart'
import type { TopProductsDirection, TopProductsMetric } from '@/components/analytics/types'
import { useAnalyticsSummary } from '@/features/analytics/hooks/useAnalyticsSummary'
import { useMovementsOverTime } from '@/features/analytics/hooks/useMovementsOverTime'
import { useTopProducts } from '@/features/analytics/hooks/useTopProducts'

const TOP_PRODUCTS_LIMIT = 8

export function AnalyticsPage() {
  const { user } = useAuth()
  const [range, setRange] = useState<DateRange>(defaultDateRange)
  const [metric, setMetric] = useState<TopProductsMetric>('value')
  const [direction, setDirection] = useState<TopProductsDirection>('in')

  const params = { from: toApiDateTime(range.from), to: toApiDateTime(range.to) }
  const granularity = granularityForRange(range.from, range.to)
  const rangeLabel = formatDateRange(range.from, range.to)
  const canViewProducts = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.MANAGE_PRODUCTS)

  const { data: summary, loading: summaryLoading, error: summaryError } = useAnalyticsSummary(params)
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Analytics</h1>
          <p className="text-sm text-neutral-500">Stock movement trends and top products.</p>
        </div>
        <DateRangeControl value={range} onChange={setRange} />
      </div>

      {summaryLoading && !summary && <SummaryCardsSkeleton />}

      {summaryError && !summary && (
        <div className="rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {summaryError}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Stock In Value"
            value={formatCompactCurrency(summary.totalInValue)}
            subtitle={rangeLabel}
            icon={PackagePlus}
          />
          <StatCard
            label="Stock Out Value"
            value={formatCompactCurrency(summary.totalOutValue)}
            subtitle={rangeLabel}
            icon={PackageMinus}
          />
          <StatCard
            label="Units Moved In"
            value={formatNumber(summary.totalUnitsIn)}
            subtitle={rangeLabel}
            icon={ArrowDownToLine}
          />
          <StatCard
            label="Units Moved Out"
            value={formatNumber(summary.totalUnitsOut)}
            subtitle={rangeLabel}
            icon={ArrowUpFromLine}
          />
          <StatCard
            label="Active Products"
            value={formatNumber(summary.activeProductCount)}
            subtitle="Currently active in catalog"
            icon={PackageCheck}
          />
          <StatCard
            label="Low Stock"
            value={formatNumber(summary.lowStockProductCount)}
            subtitle={summary.lowStockProductCount > 0 ? 'Needs attention' : 'All stocked up'}
            icon={AlertTriangle}
            variant="warning"
            href={canViewProducts ? '/products/low-stock' : undefined}
          />
        </div>
      )}

      <ChartCard title="Movements over time" subtitle="Stock-in vs stock-out value">
        <MovementsChart data={movements} loading={movementsLoading} error={movementsError} granularity={granularity} />
      </ChartCard>

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
    </div>
  )
}
