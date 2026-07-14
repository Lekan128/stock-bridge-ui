import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AXIS_LINE, GRIDLINE, IN_COLOR, OUT_COLOR, TICK_TEXT } from '@/components/analytics/chartTokens'
import { ChartEmptyState } from '@/components/analytics/ChartEmptyState'
import { ChartSkeleton } from '@/components/analytics/ChartSkeleton'
import { formatCompactCurrency, formatCurrency, formatPeriod } from '@/components/analytics/formatters'
import type { Granularity, MovementsOverTimePoint } from '@/components/analytics/types'
import { useMediaQuery } from '@/hooks/useMediaQuery'

export interface MovementsChartProps {
  data: MovementsOverTimePoint[] | null
  loading: boolean
  error: string | null
  granularity: Granularity
}

interface TooltipPayloadEntry {
  dataKey: string
  name: string
  value: number
  color: string
}

function MovementsTooltip({
  active,
  payload,
  label,
  granularity,
}: {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  label?: string
  granularity: Granularity
}) {
  if (!active || !payload?.length || !label) return null
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-neutral-500">{formatPeriod(label, granularity)}</p>
      <div className="mt-1.5 flex flex-col gap-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
            <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-neutral-500">{entry.name}</span>
            <span className="ml-auto font-semibold tabular-nums text-neutral-900">{formatCurrency(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MovementsChart({ data, loading, error, granularity }: MovementsChartProps) {
  const isMobile = useMediaQuery('(max-width: 639px)')

  const tickInterval = useMemo(() => {
    if (!data) return 0
    const maxTicks = isMobile ? 3 : 10
    return data.length > maxTicks ? Math.ceil(data.length / maxTicks) - 1 : 0
  }, [data, isMobile])

  if (loading && !data) return <ChartSkeleton />

  if (error && !data) {
    return <div className="rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
  }

  if (!data || data.every((point) => point.inValue === 0 && point.outValue === 0)) {
    return <ChartEmptyState />
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRIDLINE} vertical={false} />
        <XAxis
          dataKey="period"
          tickFormatter={(value: string) => formatPeriod(value, granularity, isMobile)}
          interval={tickInterval}
          tick={{ fontSize: 12, fill: TICK_TEXT }}
          axisLine={{ stroke: AXIS_LINE }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(value: number) => formatCompactCurrency(value)}
          tick={{ fontSize: 12, fill: TICK_TEXT }}
          axisLine={false}
          tickLine={false}
          width={isMobile ? 48 : 64}
        />
        <Tooltip content={<MovementsTooltip granularity={granularity} />} />
        <Legend wrapperStyle={{ fontSize: 13 }} iconType="square" />
        <Area
          type="monotone"
          dataKey="inValue"
          name="Stock In"
          stroke={IN_COLOR}
          fill={IN_COLOR}
          fillOpacity={0.1}
          strokeWidth={2}
          animationDuration={400}
        />
        <Area
          type="monotone"
          dataKey="outValue"
          name="Stock Out"
          stroke={OUT_COLOR}
          fill={OUT_COLOR}
          fillOpacity={0.1}
          strokeWidth={2}
          animationDuration={400}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
