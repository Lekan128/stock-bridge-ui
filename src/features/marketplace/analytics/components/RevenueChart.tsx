import { useMemo } from 'react'
import { Area, Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartEmptyState } from '@/components/analytics/ChartEmptyState'
import { ChartSkeleton } from '@/components/analytics/ChartSkeleton'
import { formatCompactCurrency, formatNumber, formatPeriod } from '@/components/analytics/formatters'
import { AXIS_LINE, GRIDLINE, REVENUE_COLOR, TICK_TEXT, VOLUME_COLOR } from '@/features/marketplace/analytics/chartPalette'
import { AnalyticsErrorState } from '@/features/marketplace/analytics/components/AnalyticsErrorState'
import type { Granularity, RevenuePoint } from '@/features/marketplace/analytics/types'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { formatNaira } from '@/utils/money'

export interface RevenueChartProps {
  data: RevenuePoint[] | null
  loading: boolean
  error: string | null
  onRetry: () => void
  granularity: Granularity
}

/** The server's UPPERCASE enum vs the shared `formatPeriod` helper's lowercase union. */
function toTickGranularity(granularity: Granularity): 'day' | 'week' | 'month' {
  return granularity.toLowerCase() as 'day' | 'week' | 'month'
}

interface TooltipProps {
  active?: boolean
  label?: string
  payload?: { payload: RevenuePoint }[]
  granularity: Granularity
}

/**
 * Custom rather than recharts' default because the bar and the area are two different
 * units — naira and orders — and the stock tooltip would present them as one list of
 * comparable numbers.
 */
function RevenueTooltip({ active, label, payload, granularity }: TooltipProps) {
  if (!active || !payload?.length || !label) return null
  const point = payload[0].payload

  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-neutral-500">{formatPeriod(label, toTickGranularity(granularity))}</p>
      <p className="mt-1.5 text-sm font-semibold tabular-nums text-neutral-900">{formatNaira(point.revenue)}</p>
      <dl className="mt-1 flex flex-col gap-0.5 text-xs text-neutral-500">
        <div className="flex items-center gap-3">
          <dt>Orders</dt>
          <dd className="ml-auto tabular-nums text-neutral-700">{formatNumber(point.orderCount)}</dd>
        </div>
        <div className="flex items-center gap-3">
          <dt>Units</dt>
          <dd className="ml-auto tabular-nums text-neutral-700">{formatNumber(point.unitsSold)}</dd>
        </div>
        <div className="flex items-center gap-3">
          <dt>Companies</dt>
          <dd className="ml-auto tabular-nums text-neutral-700">{formatNumber(point.buyingCompanies)}</dd>
        </div>
      </dl>
    </div>
  )
}

/**
 * Revenue per bucket as bars, with order count as a faint area behind them.
 *
 * Two marks rather than one because the interesting question is when they DISAGREE: a
 * revenue spike with a flat order line is one large customer, and a rising order line with
 * flat revenue is the basket getting smaller. Neither is visible on a revenue-only chart.
 * The area carries no axis of its own — it is deliberately unreadable as an absolute
 * number and is there for its shape, with the exact counts in the tooltip.
 *
 * The series is zero-filled by the API, so quiet days are drawn as real zeroes and the
 * bars never lie about a gap.
 */
export function RevenueChart({ data, loading, error, onRetry, granularity }: RevenueChartProps) {
  const isMobile = useMediaQuery('(max-width: 639px)')

  const tickInterval = useMemo(() => {
    if (!data) return 0
    const maxTicks = isMobile ? 3 : 10
    return data.length > maxTicks ? Math.ceil(data.length / maxTicks) - 1 : 0
  }, [data, isMobile])

  // Orders are rescaled onto the revenue axis so the two marks share one grid. Without
  // this the area either flatlines against millions of naira or dwarfs it entirely.
  const scaled = useMemo(() => {
    if (!data?.length) return []
    const maxRevenue = Math.max(...data.map((point) => point.revenue), 0)
    const maxOrders = Math.max(...data.map((point) => point.orderCount), 0)
    const factor = maxOrders > 0 && maxRevenue > 0 ? maxRevenue / maxOrders : 0
    return data.map((point) => ({ ...point, scaledOrders: point.orderCount * factor }))
  }, [data])

  if (loading && !data) return <ChartSkeleton />
  if (error && !data) return <AnalyticsErrorState message={error} onRetry={onRetry} />

  if (!data?.length || data.every((point) => point.revenue === 0 && point.orderCount === 0)) {
    return <ChartEmptyState message="No orders were placed in this period" />
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={scaled} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRIDLINE} vertical={false} />
        <XAxis
          dataKey="period"
          tickFormatter={(value: string) => formatPeriod(value, toTickGranularity(granularity), isMobile)}
          interval={tickInterval}
          tick={{ fontSize: 12, fill: TICK_TEXT }}
          axisLine={{ stroke: AXIS_LINE }}
          tickLine={false}
        />
        <YAxis
          // Compact on the axis, exact in the tooltip: `₦1,234,567.89` ticks force the plot
          // area down to nothing at 375px.
          tickFormatter={(value: number) => formatCompactCurrency(value)}
          tick={{ fontSize: 12, fill: TICK_TEXT }}
          axisLine={false}
          tickLine={false}
          width={isMobile ? 52 : 68}
        />
        <Tooltip
          content={<RevenueTooltip granularity={granularity} />}
          cursor={{ fill: 'color-mix(in srgb, var(--color-neutral-900) 4%, transparent)' }}
        />
        <Area
          type="monotone"
          dataKey="scaledOrders"
          stroke={VOLUME_COLOR}
          fill={VOLUME_COLOR}
          fillOpacity={0.08}
          strokeWidth={1.5}
          strokeDasharray="4 3"
          animationDuration={400}
          // Its own tooltip row would show the rescaled value, which means nothing.
          tooltipType="none"
        />
        <Bar dataKey="revenue" fill={REVENUE_COLOR} radius={[3, 3, 0, 0]} maxBarSize={44} animationDuration={400} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
