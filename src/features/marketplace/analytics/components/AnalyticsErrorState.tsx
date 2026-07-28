import { AlertCircle } from 'lucide-react'
import { buttonClassName } from '@/components/Button'

export interface AnalyticsErrorStateProps {
  message: string
  onRetry: () => void
  /** `card` fills a ChartCard's body; `banner` sits above the summary grid. */
  variant?: 'card' | 'banner'
}

/**
 * The failure state for one panel, with the retry the dashboard's plain red banner does
 * not offer. It is per-panel on purpose: six independent requests back this page, and one
 * of them failing must not blank the other five — the operator can still read the revenue
 * chart while the customer ranking retries.
 *
 * Lives in this module rather than reusing the marketplace feature's `QueryErrorState` so
 * that a change to the fulfilment queue's error copy cannot silently restyle an analytics
 * panel, and vice versa.
 */
export function AnalyticsErrorState({ message, onRetry, variant = 'card' }: AnalyticsErrorStateProps) {
  if (variant === 'banner') {
    return (
      <div
        role="alert"
        className="flex flex-col gap-3 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-2 text-sm text-danger-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{message}</span>
        </div>
        {/* buttonClassName() hard-codes inline-flex, so it is used alone and never combined
            with a responsive display utility that it would beat. */}
        <button type="button" onClick={onRetry} className={buttonClassName('secondary')}>
          Try again
        </button>
      </div>
    )
  }

  return (
    <div role="alert" className="flex h-64 flex-col items-center justify-center gap-3 px-4 text-center">
      <AlertCircle className="h-8 w-8 text-danger-400" aria-hidden="true" />
      <p className="text-sm text-neutral-700">{message}</p>
      <button type="button" onClick={onRetry} className={buttonClassName('secondary')}>
        Try again
      </button>
    </div>
  )
}
