import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { ChartEmptyState } from '@/components/analytics/ChartEmptyState'
import { ChartSkeleton } from '@/components/analytics/ChartSkeleton'
import { formatNumber } from '@/components/analytics/formatters'
import { categoryColor } from '@/features/marketplace/analytics/chartPalette'
import { AnalyticsErrorState } from '@/features/marketplace/analytics/components/AnalyticsErrorState'
import { formatShare } from '@/features/marketplace/analytics/formatters'
import type { CategoryMix, CategoryMixEntry } from '@/features/marketplace/analytics/types'
import { formatNaira, formatNairaCompact } from '@/utils/money'

export interface CategoryMixChartProps {
  data: CategoryMix | null
  loading: boolean
  error: string | null
  onRetry: () => void
}

function MixTooltip({ active, payload }: { active?: boolean; payload?: { payload: CategoryMixEntry }[] }) {
  if (!active || !payload?.length) return null
  const slice = payload[0].payload

  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-sm font-medium text-neutral-900">{slice.categoryName}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-neutral-900">{formatNaira(slice.revenue)}</p>
      <dl className="mt-1 flex flex-col gap-0.5 text-xs text-neutral-500">
        <div className="flex items-center gap-3">
          <dt>Share</dt>
          <dd className="ml-auto tabular-nums text-neutral-700">{formatShare(slice.share)}</dd>
        </div>
        <div className="flex items-center gap-3">
          <dt>Units</dt>
          <dd className="ml-auto tabular-nums text-neutral-700">{formatNumber(slice.quantitySold)}</dd>
        </div>
        <div className="flex items-center gap-3">
          <dt>Orders</dt>
          <dd className="ml-auto tabular-nums text-neutral-700">{formatNumber(slice.orderCount)}</dd>
        </div>
      </dl>
    </div>
  )
}

/**
 * Revenue split across catalog categories: a donut, plus a legend that is really a table.
 *
 * The donut alone would be near-useless — humans cannot rank arc angles, and a marketplace
 * with nine categories produces several indistinguishable slivers. So the ranked list
 * beside it carries the actual numbers and does the reading work, and the donut carries the
 * one thing a list is bad at: how concentrated the mix is. Colour is never the only channel
 * — every legend row names its category and states its share in text.
 *
 * Note this is GOODS revenue (order line totals). It sums to the summary's merchandise
 * figure, not to gross revenue, because a per-order delivery fee belongs to no category.
 * The caption in the page header says so; it is not left for the reader to infer from a
 * total that does not tie out.
 */
export function CategoryMixChart({ data, loading, error, onRetry }: CategoryMixChartProps) {
  if (loading && !data) return <ChartSkeleton />
  if (error && !data) return <AnalyticsErrorState message={error} onRetry={onRetry} />
  if (!data || data.categories.length === 0 || data.totalRevenue === 0) {
    return <ChartEmptyState message="Nothing was sold in this period, so there is no mix to show" />
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
      {/* `relative` + an absolutely-centred overlay rather than recharts' label prop: the
          total needs two type sizes, and a negative margin would drift with the container. */}
      <div className="relative w-full lg:w-1/2">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={data.categories}
              dataKey="revenue"
              nameKey="categoryName"
              innerRadius="55%"
              outerRadius="85%"
              paddingAngle={1.5}
              // The hole is not decoration: it carries the total, so the chart answers
              // "how much, split how" rather than only the second half.
              animationDuration={400}
              stroke="var(--color-neutral-50)"
              strokeWidth={2}
            >
              {data.categories.map((slice, index) => (
                <Cell key={slice.categoryId ?? slice.categoryName} fill={categoryColor(index)} />
              ))}
            </Pie>
            <Tooltip content={<MixTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-neutral-500">Goods revenue</span>
          <span className="text-lg font-semibold tabular-nums text-neutral-900">
            {formatNairaCompact(data.totalRevenue)}
          </span>
        </div>
      </div>

      {/* The legend is the readable half. `<ul>` rather than recharts' <Legend> so it can
          carry three columns and stay a list for a screen reader. */}
      <ul className="flex w-full flex-col gap-2 lg:w-1/2">
        {data.categories.map((slice, index) => (
          <li
            key={slice.categoryId ?? slice.categoryName}
            className="flex items-center gap-2.5 border-b border-neutral-100 pb-2 last:border-b-0 last:pb-0"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: categoryColor(index) }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate text-sm text-neutral-700" title={slice.categoryName}>
              {slice.categoryName}
            </span>
            <span className="shrink-0 text-sm tabular-nums text-neutral-900">{formatNairaCompact(slice.revenue)}</span>
            <span className="w-12 shrink-0 text-right text-xs tabular-nums text-neutral-500">
              {formatShare(slice.share)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
