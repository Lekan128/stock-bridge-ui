import { CircleCheck } from 'lucide-react'
import { copy } from '@/features/imports/copy'
import type { ImportSession } from '@/features/imports/types'

/**
 * What most files see.
 *
 * Contract §8.2: a clean file never shows a grid. Most spreadsheets are fine, and making the
 * majority scroll a correct 300-row table to prove it turns the review step into a toll booth —
 * the exact failure this whole screen was designed to avoid. One green line, one button, gone.
 */
export function CleanFileSummary({ session }: { session: ImportSession }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-accent-200 bg-accent-50 px-4 py-4">
      <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold text-accent-800">{copy.review.allGood(session.validCount)}</p>
        <p className="mt-1 text-sm text-accent-700">{copy.review.allGoodBody}</p>
        {session.skippedCount > 0 && (
          <p className="mt-1 text-sm text-accent-700">{copy.review.allGoodSkipped(session.skippedCount)}</p>
        )}
      </div>
    </div>
  )
}
