import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartEmptyState } from '@/components/analytics/ChartEmptyState'
import { HorizontalBarsSkeleton } from '@/components/analytics/HorizontalBarsSkeleton'
import { formatCompactNumber, formatNumber } from '@/components/analytics/formatters'
import { AXIS_LINE, GRIDLINE, TICK_TEXT } from '@/features/marketplace/analytics/chartPalette'
import { AnalyticsErrorState } from '@/features/marketplace/analytics/components/AnalyticsErrorState'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { formatNaira, formatNairaCompact } from '@/utils/money'

const NAME_TRUNCATE_LENGTH = 18

function truncate(name: string): string {
  return name.length > NAME_TRUNCATE_LENGTH ? `${name.slice(0, NAME_TRUNCATE_LENGTH - 1)}…` : name
}

export interface RankedRow {
  /** Stable React/recharts key. */
  id: string
  label: string
  /** The number being ranked on. */
  value: number
  /** Extra lines for the tooltip — label/value pairs, already formatted. */
  details: { label: string; value: string }[]
}

export interface RankedBarsChartProps {
  rows: RankedRow[] | null
  loading: boolean
  error: string | null
  onRetry: () => void
  /** Decides both the axis ticks and the end-of-bar labels. */
  unit: 'currency' | 'count'
  color: string
  /** Copy for "the marketplace has sold nothing in this window". */
  emptyMessage: string
  /** Controls (metric toggles) rendered above the plot. */
  controls?: ReactNode
}

function formatValue(value: number, unit: 'currency' | 'count', compact: boolean): string {
  if (unit === 'currency') return compact ? formatNairaCompact(value) : formatNaira(value)
  return compact ? formatCompactNumber(value) : formatNumber(value)
}

function RankedTooltip({
  active,
  payload,
  unit,
  color,
}: {
  active?: boolean
  payload?: { payload: RankedRow }[]
  unit: 'currency' | 'count'
  color: string
}) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload

  return (
    <div className="max-w-64 rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-lg">
      {/* Full name here — the Y axis truncates at 18 characters, and the tooltip is the
          only place the operator can read which "Dangote Cement 42.5 (50kg)…" this is. */}
      <p className="text-sm font-medium text-neutral-900">{row.label}</p>
      <div className="mt-1.5 flex items-center gap-2 text-sm">
        <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="font-semibold tabular-nums text-neutral-900">{formatValue(row.value, unit, false)}</span>
      </div>
      {row.details.length > 0 && (
        <dl className="mt-1.5 flex flex-col gap-0.5 border-t border-neutral-100 pt-1.5 text-xs text-neutral-500">
          {row.details.map((detail) => (
            <div key={detail.label} className="flex items-center gap-3">
              <dt>{detail.label}</dt>
              <dd className="ml-auto tabular-nums text-neutral-700">{detail.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

/**
 * The shared ranked-horizontal-bars body behind both the customer and the product
 * rankings. Horizontal because the labels are company and product names — long, and
 * unreadable rotated 45° under a vertical bar.
 *
 * Deliberately a sibling of `@/components/analytics/TopProductsChart` rather than a reuse
 * of it: that component is hard-wired to the stock-movement `TopProductEntry` shape and to
 * an in/out direction toggle that means nothing here. The visual language — bar radius,
 * label placement, truncation length, tooltip chrome — is copied exactly so the two read
 * as one component.
 *
 * The height grows with the row count so eight customers and three customers both look
 * intentional rather than leaving a chart two-thirds empty.
 */
export function RankedBarsChart({
  rows,
  loading,
  error,
  onRetry,
  unit,
  color,
  emptyMessage,
  controls,
}: RankedBarsChartProps) {
  const isMobile = useMediaQuery('(max-width: 639px)')

  return (
    <div className="flex flex-col gap-4">
      {controls && <div className="flex flex-wrap items-center gap-3">{controls}</div>}

      {loading && !rows && <HorizontalBarsSkeleton />}
      {error && !rows && <AnalyticsErrorState message={error} onRetry={onRetry} />}
      {rows && rows.length === 0 && <ChartEmptyState message={emptyMessage} />}

      {rows && rows.length > 0 && (
        <ResponsiveContainer width="100%" height={Math.max(rows.length * 38, 160)}>
          <BarChart
            data={rows}
            layout="vertical"
            // Right margin leaves room for the end-of-bar value label; without it the
            // longest bar's label is clipped by the container.
            margin={{ top: 0, right: isMobile ? 56 : 72, left: 0, bottom: 0 }}
            barCategoryGap={8}
          >
            <CartesianGrid stroke={GRIDLINE} horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(value: number) => formatValue(value, unit, true)}
              tick={{ fontSize: 12, fill: TICK_TEXT }}
              axisLine={{ stroke: AXIS_LINE }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              tickFormatter={(value: string) => truncate(value)}
              tick={{ fontSize: 12, fill: TICK_TEXT }}
              axisLine={false}
              tickLine={false}
              width={isMobile ? 96 : 130}
            />
            <Tooltip
              content={<RankedTooltip unit={unit} color={color} />}
              cursor={{ fill: 'color-mix(in srgb, var(--color-neutral-900) 4%, transparent)' }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20} fill={color} animationDuration={400}>
              <LabelList
                dataKey="value"
                position="right"
                formatter={(value: unknown) => formatValue(Number(value), unit, true)}
                style={{ fontSize: 12, fill: 'var(--color-neutral-900)' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
