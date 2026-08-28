import { CircleCheck, CircleSlash, Info, TriangleAlert } from 'lucide-react'
import { copy } from '@/features/imports/copy'
import type { RowFilter } from '@/features/imports/hooks/useImportRows'
import type { ImportSession } from '@/features/imports/types'

export interface ReviewCountersProps {
  session: ImportSession
  filter: RowFilter
  onFilterChange: (filter: RowFilter) => void
  /** Hidden when there is nothing to filter — a clean file has one view. */
  showFilter: boolean
}

/**
 * The one line that tells someone whether they have work to do.
 *
 * `aria-live="polite"` on the counters is the point of the component: fixing twelve rows with
 * one button changes a number a sighted user watches drop, and a screen-reader user has to hear
 * the same thing or the highest-value interaction on the page is silent to them.
 *
 * The announcement is carried by one always-present sentence rather than by the visible spans,
 * because those spans are *removed* from the DOM when their count reaches zero — and a node
 * leaving a live region is not announced by any of the major screen readers. The single moment
 * that most needs to be heard, "12 need attention" becoming nothing at all, was the one moment
 * the obvious markup would have stayed silent for. The visible row is `aria-hidden` because the
 * sentence beside it already says the same thing, in better English.
 *
 * Warnings get their own counter rather than being folded into "need attention". They are not
 * blocking, and inflating the blocking number with things that are merely worth knowing would
 * make the number untrustworthy — which is the fastest way to make people stop reading it.
 */
export function ReviewCounters({ session, filter, onFilterChange, showFilter }: ReviewCountersProps) {
  const segment = (value: RowFilter, label: string) => {
    const active = filter === value
    return (
      <button
        key={value}
        type="button"
        // Toggle buttons, not `role="radio"`. A radio group is a single tab stop that Arrow keys
        // move within, and this one is two ordinary tab stops with no arrow handling — so the
        // radio roles promised assistive technology a keyboard contract the markup does not
        // honour. `aria-pressed` describes what is actually here: two buttons, one of them on.
        aria-pressed={active}
        onClick={() => onFilterChange(value)}
        className={`inline-flex min-h-11 items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:min-h-0 ${
          active ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
        }`}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <div aria-live="polite" aria-atomic="true">
        <span className="sr-only">
          {copy.review.liveSummary(session.validCount, session.errorCount, session.warningCount)}
        </span>
        <span aria-hidden="true" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium text-accent-700">
            <CircleCheck className="h-4 w-4" aria-hidden="true" />
            {copy.review.ready(session.validCount)}
          </span>
          {session.errorCount > 0 && (
            <span className="inline-flex items-center gap-1.5 font-medium text-danger-700">
              <TriangleAlert className="h-4 w-4" aria-hidden="true" />
              {copy.review.needAttention(session.errorCount)}
            </span>
          )}
          {session.warningCount > 0 && (
            <span className="inline-flex items-center gap-1.5 font-medium text-warning-700">
              <Info className="h-4 w-4" aria-hidden="true" />
              {copy.review.toCheck(session.warningCount)}
            </span>
          )}
          {session.skippedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-neutral-500">
              <CircleSlash className="h-4 w-4" aria-hidden="true" />
              {copy.review.skipped(session.skippedCount)}
            </span>
          )}
        </span>
      </div>

      {showFilter && (
        <div
          role="group"
          aria-label={copy.review.filterLabel}
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-neutral-100 p-1"
        >
          {segment('ALL', copy.review.filterAll)}
          {segment('ISSUES', copy.review.filterIssues)}
        </div>
      )}
    </div>
  )
}
