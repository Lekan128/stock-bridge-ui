import { ChevronDown, CircleCheck } from 'lucide-react'
import { copy } from '@/features/imports/copy'
import type { ImportSession } from '@/features/imports/types'

export interface CleanFileSummaryProps {
  session: ImportSession
  /** Whether the rows are open beneath this summary. */
  expanded: boolean
  onToggle: () => void
  /** The id of the region the toggle opens, for `aria-controls`. */
  controlsId: string
}

/**
 * What most files see.
 *
 * Contract §8.2: a clean file never *opens on* a grid. Most spreadsheets are fine, and making the
 * majority scroll a correct 300-row table to prove it turns the review step into a toll booth —
 * the exact failure this whole screen was designed to avoid. One green line, one button, gone.
 *
 * But "we checked" is a claim, and some people want to see it before they commit a few hundred
 * products to their catalog. So the rows sit one click away, closed by default: the person who
 * trusts the green line pays nothing, and the person who wants to double-check never has to go
 * back to Excel to do it.
 */
export function CleanFileSummary({ session, expanded, onToggle, controlsId }: CleanFileSummaryProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-accent-200 bg-accent-50 px-4 py-4">
      <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-accent-800">{copy.review.allGood(session.validCount)}</p>
        <p className="mt-1 text-sm text-accent-700">{copy.review.allGoodBody}</p>
        {session.skippedCount > 0 && (
          <p className="mt-1 text-sm text-accent-700">{copy.review.allGoodSkipped(session.skippedCount)}</p>
        )}
        {session.validCount > 0 && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={controlsId}
            className="-ml-1 mt-2 inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-sm font-medium text-accent-800 underline underline-offset-2 hover:text-accent-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:min-h-0 sm:py-1"
          >
            {expanded ? copy.review.hideRows : copy.review.seeRows(session.validCount)}
            <ChevronDown
              className={`h-4 w-4 transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
        )}
      </div>
    </div>
  )
}
