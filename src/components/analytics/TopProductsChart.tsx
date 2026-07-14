import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AXIS_LINE, GRIDLINE, IN_COLOR, OUT_COLOR, TICK_TEXT } from '@/components/analytics/chartTokens'
import { ChartEmptyState } from '@/components/analytics/ChartEmptyState'
import { HorizontalBarsSkeleton } from '@/components/analytics/HorizontalBarsSkeleton'
import { formatCompactCurrency, formatCompactNumber, formatCurrency, formatNumber } from '@/components/analytics/formatters'
import type { TopProductEntry, TopProductsDirection, TopProductsMetric } from '@/components/analytics/types'

const NAME_TRUNCATE_LENGTH = 18

function truncateName(name: string): string {
  return name.length > NAME_TRUNCATE_LENGTH ? `${name.slice(0, NAME_TRUNCATE_LENGTH - 1)}…` : name
}

export interface TopProductsChartProps {
  data: TopProductEntry[] | null
  loading: boolean
  error: string | null
  metric: TopProductsMetric
  onMetricChange: (metric: TopProductsMetric) => void
  direction: TopProductsDirection
  onDirectionChange: (direction: TopProductsDirection) => void
}

function TopProductsTooltip({
  active,
  payload,
  metric,
  color,
}: {
  active?: boolean
  payload?: { payload: TopProductEntry }[]
  metric: TopProductsMetric
  color: string
}) {
  if (!active || !payload?.length) return null
  const entry = payload[0].payload
  const formatted = metric === 'value' ? formatCurrency(entry.value) : formatNumber(entry.quantity)
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-sm font-medium text-neutral-900">{entry.name}</p>
      <p className="text-xs text-neutral-500">{entry.sku}</p>
      <div className="mt-1.5 flex items-center gap-2 text-sm">
        <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="font-semibold tabular-nums text-neutral-900">{formatted}</span>
      </div>
    </div>
  )
}

interface SegmentedControlProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  label: string
}

function SegmentedControl<T extends string>({ value, onChange, options, label }: SegmentedControlProps<T>) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-0.5" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
            value === option.value ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function TopProductsChart({
  data,
  loading,
  error,
  metric,
  onMetricChange,
  direction,
  onDirectionChange,
}: TopProductsChartProps) {
  const color = direction === 'in' ? IN_COLOR : OUT_COLOR

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Metric"
          value={metric}
          onChange={onMetricChange}
          options={[
            { value: 'value', label: 'Value' },
            { value: 'quantity', label: 'Quantity' },
          ]}
        />
        <SegmentedControl
          label="Direction"
          value={direction}
          onChange={onDirectionChange}
          options={[
            { value: 'in', label: 'In' },
            { value: 'out', label: 'Out' },
          ]}
        />
      </div>

      {loading && !data && <HorizontalBarsSkeleton />}

      {error && !data && (
        <div className="rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      {data && data.length === 0 && <ChartEmptyState message="No activity in this period" />}

      {data && data.length > 0 && (
        <ResponsiveContainer width="100%" height={Math.max(data.length * 36, 160)}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }} barCategoryGap={8}>
            <CartesianGrid stroke={GRIDLINE} horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(value: number) => (metric === 'value' ? formatCompactCurrency(value) : formatCompactNumber(value))}
              tick={{ fontSize: 12, fill: TICK_TEXT }}
              axisLine={{ stroke: AXIS_LINE }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tickFormatter={(value: string) => truncateName(value)}
              tick={{ fontSize: 12, fill: TICK_TEXT }}
              axisLine={false}
              tickLine={false}
              width={110}
            />
            <Tooltip content={<TopProductsTooltip metric={metric} color={color} />} cursor={{ fill: 'rgba(11,11,11,0.03)' }} />
            <Bar dataKey={metric} radius={[0, 4, 4, 0]} maxBarSize={20} fill={color} animationDuration={400}>
              <LabelList
                dataKey={metric}
                position="right"
                formatter={(value: unknown) =>
                  metric === 'value' ? formatCompactCurrency(Number(value)) : formatCompactNumber(Number(value))
                }
                style={{ fontSize: 12, fill: '#171a21' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
