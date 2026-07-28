import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight, Minus, Sparkles } from 'lucide-react'
import { computeDelta, type DeltaDirection } from '@/features/marketplace/analytics/formatters'

export interface MetricCardProps {
  label: string
  value: string
  icon: LucideIcon
  /** Raw current/previous values. Omit `previous` for a figure with no meaningful baseline. */
  current?: number
  previous?: number
  /**
   * Whether a rise is good news. `false` flips the delta's colour — outstanding backlog and
   * pay-on-delivery exposure going UP is the bad direction, and a green arrow there would
   * be actively misleading.
   */
  higherIsBetter?: boolean
  /** Sits under the delta. Use it for what the number means, not for the date range. */
  hint?: string
  variant?: 'default' | 'warning'
}

const DELTA_ICONS: Record<DeltaDirection, LucideIcon> = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
  none: Minus,
  new: Sparkles,
}

/**
 * A summary tile with a period-over-period delta.
 *
 * Mirrors `@/components/analytics/StatCard` class for class — same border, radius, icon
 * chip, type scale and warning variant — rather than wrapping it, because StatCard renders
 * a plain string subtitle and a delta needs its own icon, its own colour and its own
 * semantics (see `higherIsBetter`). Copying the shell keeps the two screens visually
 * identical; extending StatCard would have meant editing a file three other pages depend
 * on. If StatCard ever grows a delta slot, this should collapse into it.
 *
 * Colour is never the only signal: every delta carries a direction arrow and a text label.
 */
export function MetricCard({
  label,
  value,
  icon: Icon,
  current,
  previous,
  higherIsBetter = true,
  hint,
  variant = 'default',
}: MetricCardProps) {
  const isWarning = variant === 'warning'
  const delta = current != null && previous != null ? computeDelta(current, previous) : null
  const DeltaIcon = delta ? DELTA_ICONS[delta.direction] : null

  // "Good" is about the metric, not the arrow: a falling backlog is a win.
  const isGood = delta?.direction === (higherIsBetter ? 'up' : 'down')
  const isBad = delta?.direction === (higherIsBetter ? 'down' : 'up')
  const deltaTone = isGood
    ? 'bg-accent-50 text-accent-700'
    : isBad
      ? 'bg-danger-50 text-danger-700'
      : 'bg-neutral-100 text-neutral-600'

  return (
    <div
      className={`h-full rounded-lg border p-5 ${
        isWarning ? 'border-warning-200 bg-warning-50' : 'border-neutral-200 bg-white'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            isWarning ? 'bg-warning-100 text-warning-600' : 'bg-primary-50 text-primary-600'
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <p className={`text-sm font-medium ${isWarning ? 'text-warning-900' : 'text-neutral-900'}`}>{label}</p>
      </div>

      <p className={`mt-3 text-2xl font-semibold tabular-nums ${isWarning ? 'text-warning-700' : 'text-neutral-900'}`}>
        {value}
      </p>

      {delta && DeltaIcon && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${deltaTone}`}>
            <DeltaIcon className="h-3 w-3" aria-hidden="true" />
            {delta.label}
          </span>
          <span className="text-xs text-neutral-500">vs previous period</span>
        </div>
      )}

      {hint && <p className={`mt-2 text-xs ${isWarning ? 'text-warning-700' : 'text-neutral-500'}`}>{hint}</p>}
    </div>
  )
}
