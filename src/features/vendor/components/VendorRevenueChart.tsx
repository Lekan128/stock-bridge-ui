import { useMemo } from 'react'
import { Area, Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartEmptyState } from '@/components/analytics/ChartEmptyState'
import { ChartSkeleton } from '@/components/analytics/ChartSkeleton'
import { formatCompactCurrency, formatNumber, formatPeriod } from '@/components/analytics/formatters'
import {
  AXIS_LINE,
  GRIDLINE,
  REVENUE_COLOR,
  TICK_TEXT,
  VOLUME_COLOR,
} from '@/features/marketplace/analytics/chartPalette'
import { AnalyticsErrorState } from '@/features/marketplace/analytics/components/AnalyticsErrorState'
import type { Granularity, VendorRevenuePoint } from '@/features/vendor/types'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { formatNaira } from '@/utils/money'

export interface VendorRevenueChartProps {
  data: VendorRevenuePoint[] | null
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
  payload?: { payload: VendorRevenuePoint }[]
  granularity: Granularity
}

function VendorRevenueTooltip({ active, label, payload, granularity }: TooltipProps) {
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
      </dl>
    </div>
  )
}

/**
 * A seller's own revenue per bucket as bars, with order count as a faint area behind them.
 *
 * <h2>Why this is a near-copy of the marketplace RevenueChart rather than a reuse of it</h2>
 * One row's difference, and it is a row that must not exist here. That chart's tooltip shows a
 * "Companies" line — how many distinct buyers ordered in the bucket — and a seller's own-sales
 * view deliberately carries no buyer aggregates at all, so `VendorRevenuePoint` has no such
 * field. Making the shared chart render it optionally would put a buyer-identity code path one
 * undefined check away from this screen; passing a synthetic zero would print a number that is
 * simply false. The copy is forty lines and the alternative is a leak-shaped abstraction.
 *
 * Everything else is deliberately identical — same palette, same rescaling, same tick
 * thinning — so a seller and the operator are reading the same picture of the same month.
 *
 * <h2>Two marks rather than one</h2>
 * The interesting question is when they DISAGREE: a revenue spike with a flat order line is
 * one large customer, and a rising order line with flat revenue is the basket getting smaller.
 * The area carries no axis of its own — it is there for its shape, with exact counts in the
 * tooltip. The series is zero-filled by the API, so quiet days are drawn as real zeroes.
 */
export function VendorRevenueChart({ data, loading, error, onRetry, granularity }: VendorRevenueChartProps) {
  const isMobile = useMediaQuery('(max-width: 639px)')

  const tickInterval = useMemo(() => {
    if (!data) return 0
    const maxTicks = isMobile ? 3 : 10
    return data.length > maxTicks ? Math.ceil(data.length / maxTicks) - 1 : 0
  }, [data, isMobile])

  // Orders are rescaled onto the revenue axis so the two marks share one grid. Without this
  // the area either flatlines against millions of naira or dwarfs it entirely.
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
    return <ChartEmptyState message="You had no orders in this period" />
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
          content={<VendorRevenueTooltip granularity={granularity} />}
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
