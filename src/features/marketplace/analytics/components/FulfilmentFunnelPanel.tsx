import { Timer } from 'lucide-react'
import { ChartEmptyState } from '@/components/analytics/ChartEmptyState'
import { HorizontalBarsSkeleton } from '@/components/analytics/HorizontalBarsSkeleton'
import { formatNumber } from '@/components/analytics/formatters'
import { NEGATIVE_COLOR, PENDING_COLOR, REVENUE_COLOR, VOLUME_COLOR } from '@/features/marketplace/analytics/chartPalette'
import { AnalyticsErrorState } from '@/features/marketplace/analytics/components/AnalyticsErrorState'
import {
  formatDuration,
  formatShare,
  sortStatusCounts,
  stageLabel,
  statusLabel,
  transitionLabel,
} from '@/features/marketplace/analytics/formatters'
import type { FulfilmentFunnel, FunnelStage, OrderStatusName } from '@/features/marketplace/analytics/types'
import { formatNairaCompact } from '@/utils/money'

export interface FulfilmentFunnelPanelProps {
  data: FulfilmentFunnel | null
  loading: boolean
  error: string | null
  onRetry: () => void
}

/**
 * Which statuses read as trouble. PENDING_PAYMENT and CANCELLED are the two outcomes where
 * an order left the pipeline without money changing hands; everything between is normal
 * progress. Colour reinforces the reading, it never carries it alone — every row is
 * labelled and counted in text.
 */
const STATUS_TONE: Record<OrderStatusName, string> = {
  PENDING_PAYMENT: PENDING_COLOR,
  PLACED: REVENUE_COLOR,
  CONFIRMED: REVENUE_COLOR,
  PROCESSING: REVENUE_COLOR,
  OUT_FOR_DELIVERY: PENDING_COLOR,
  DELIVERED: VOLUME_COLOR,
  RECEIVED: VOLUME_COLOR,
  CANCELLED: NEGATIVE_COLOR,
}

/**
 * A hand-drawn bar rather than recharts. The funnel is five rows with a percentage and a
 * count each, and a chart library here would cost an axis, a tooltip and a responsive
 * container to render something a div with a width already says more clearly.
 */
function StageBar({ stage }: { stage: FunnelStage }) {
  const percent = Math.max(0, Math.min(1, stage.conversionRate))

  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-neutral-800">{stageLabel(stage.stage)}</span>
        <span className="text-xs tabular-nums text-neutral-500">
          <span className="font-semibold text-neutral-900">{formatNumber(stage.orderCount)}</span>{' '}
          <span aria-hidden="true">·</span> {formatShare(stage.conversionRate)}
        </span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-100"
        role="img"
        aria-label={`${stageLabel(stage.stage)}: ${formatNumber(stage.orderCount)} orders, ${formatShare(
          stage.conversionRate,
        )} of orders placed`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${percent * 100}%`, backgroundColor: REVENUE_COLOR }}
        />
      </div>
    </li>
  )
}

/**
 * Where orders are, how far they got, and how long each hop took.
 *
 * Three panels because the operational answer lives in the gap between them: a tall
 * "Confirmed" bar means nothing on its own, but a tall Confirmed bar next to a two-day
 * Confirmed → Dispatched median names the warehouse as the bottleneck. The durations are
 * the number this whole screen exists to surface.
 *
 * Unlike every other panel on the page, this one counts cancelled and never-paid orders —
 * a funnel that hides its drop-outs is not a funnel.
 */
export function FulfilmentFunnelPanel({ data, loading, error, onRetry }: FulfilmentFunnelPanelProps) {
  if (loading && !data) return <HorizontalBarsSkeleton />
  if (error && !data) return <AnalyticsErrorState message={error} onRetry={onRetry} />
  if (!data || data.totalOrders === 0) {
    return <ChartEmptyState message="No orders moved through fulfilment in this period" icon={Timer} />
  }

  const statuses = sortStatusCounts(data.statusCounts).filter((count) => count.orderCount > 0)
  const maxStatusCount = Math.max(...statuses.map((count) => count.orderCount), 1)

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section>
          <h3 className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">How far orders got</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Share of the {formatNumber(data.totalOrders)} orders in this period that ever reached each milestone,
            measured against those that reached Placed.
          </p>
          <ul className="mt-4 flex flex-col gap-3.5">
            {data.stages.map((stage) => (
              <StageBar key={stage.stage} stage={stage} />
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">Where they are now</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Current status of every order placed in this period, cancellations and abandoned checkouts included.
          </p>
          <ul className="mt-4 flex flex-col gap-3">
            {statuses.map((count) => (
              <li key={count.status} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-sm text-neutral-700" title={statusLabel(count.status)}>
                  {statusLabel(count.status)}
                </span>
                <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-100">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${(count.orderCount / maxStatusCount) * 100}%`,
                      backgroundColor: STATUS_TONE[count.status],
                    }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-neutral-900">
                  {formatNumber(count.orderCount)}
                </span>
                <span className="w-14 shrink-0 text-right text-xs tabular-nums text-neutral-500">
                  {formatNairaCompact(count.orderValue)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section>
        <h3 className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">How long each step takes</h3>
        <p className="mt-1 text-xs text-neutral-500">
          Median is the typical order; the average is dragged by the slow ones. A wide gap between them means a few
          orders are stuck, not that everything is slow.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.transitions.map((transition) => (
            <div key={transition.transition} className="rounded-md border border-neutral-200 bg-neutral-50 p-3.5">
              <p className="text-xs font-medium text-neutral-600">
                {transitionLabel(transition.fromStage, transition.toStage)}
              </p>
              <p className="mt-1.5 text-xl font-semibold tabular-nums text-neutral-900">
                {formatDuration(transition.medianHours)}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                {transition.sampleSize === 0 ? (
                  // Not "0 hrs": nothing completed this hop, and a zero would read as
                  // instant fulfilment.
                  <span>No orders completed this step yet</span>
                ) : (
                  <>
                    avg {formatDuration(transition.averageHours)} <span aria-hidden="true">·</span>{' '}
                    {formatNumber(transition.sampleSize)} order{transition.sampleSize === 1 ? '' : 's'}
                  </>
                )}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
