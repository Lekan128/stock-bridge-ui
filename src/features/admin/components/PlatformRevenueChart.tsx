import { useMemo } from 'react'
import { Area, Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartEmptyState } from '@/components/analytics/ChartEmptyState'
import { ChartSkeleton } from '@/components/analytics/ChartSkeleton'
import { formatCompactCurrency, formatNumber, formatPeriod } from '@/components/analytics/formatters'
import { AXIS_LINE, GRIDLINE, REVENUE_COLOR, TICK_TEXT, VOLUME_COLOR } from '@/features/marketplace/analytics/chartPalette'
import { AnalyticsErrorState } from '@/features/marketplace/analytics/components/AnalyticsErrorState'
import type { PlatformRevenuePoint } from '@/features/admin/types'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { formatNaira } from '@/utils/money'

export type ChartGranularity = 'DAY' | 'WEEK' | 'MONTH'

export interface PlatformRevenueChartProps {
  data: PlatformRevenuePoint[] | null
  loading: boolean
  error: string | null
  onRetry: () => void
  granularity: ChartGranularity
}

/** The server's UPPERCASE enum vs the shared `formatPeriod` helper's lowercase union. */
function toTickGranularity(granularity: ChartGranularity): 'day' | 'week' | 'month' {
  return granularity.toLowerCase() as 'day' | 'week' | 'month'
}

interface TooltipProps {
  active?: boolean
  label?: string
  payload?: { payload: PlatformRevenuePoint }[]
  granularity: ChartGranularity
}

function PlatformRevenueTooltip({ active, label, payload, granularity }: TooltipProps) {
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
        {/* The row that makes this the PLATFORM's chart rather than a seller's: how many
            sellers were actually trading in the bucket. Revenue rising while this falls is
            concentration, which is the thing an operator wants to catch early. */}
        <div className="flex items-center gap-3">
          <dt>Sellers trading</dt>
          <dd className="ml-auto tabular-nums text-neutral-700">{formatNumber(point.sellingSellerCount)}</dd>
        </div>
      </dl>
    </div>
  )
}

/**
 * Marketplace-wide revenue per bucket as bars, with order count as a faint area behind them.
 *
 * <h2>Why a third copy of this chart shape</h2>
 * The same argument `VendorRevenueChart` makes, one level up. The three revenue charts in
 * this app — ProcurePal's, a vendor's, and this one — differ only in which rows their
 * tooltips may show, and that difference is exactly the thing that must not become a
 * runtime flag. This one carries a "sellers trading" row that neither of the others may ever
 * render: on a seller's own screen it would be a count of their competitors. Making one
 * shared chart render it optionally would put that row one undefined check away from a
 * tenant page.
 *
 * <p>Everything else is deliberately identical — same palette, same rescaling, same tick
 * thinning — so the operator, a vendor and the platform are all reading the same picture of
 * the same month.
 *
 * <h2>Two marks rather than one</h2>
 * The interesting question is when they disagree: revenue up with orders flat is bigger
 * baskets, orders up with revenue flat is smaller ones. The area carries no axis of its own
 * — it is there for its shape, with exact counts in the tooltip. The series is zero-filled by
 * the API, so quiet days are drawn as real zeroes rather than skipped.
 */
export function PlatformRevenueChart({ data, loading, error, onRetry, granularity }: PlatformRevenueChartProps) {
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
    return <ChartEmptyState message="No orders were placed anywhere on the marketplace in this period" />
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
          content={<PlatformRevenueTooltip granularity={granularity} />}
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
