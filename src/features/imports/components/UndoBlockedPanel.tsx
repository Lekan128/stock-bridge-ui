import { Ban } from 'lucide-react'
import { copy } from '@/features/imports/copy'
import type { UndoBlockedResponse } from '@/features/imports/types'

/**
 * A refused undo is a message, not a failure.
 *
 * The ledger is append-only by design (spec §6.6) — a delivery someone has already sold from
 * cannot be un-received without destroying the traceability the whole multi-vendor model exists
 * to provide. So this reads as an explanation with the specific rows named, in `warning` rather
 * than `danger`: nothing has gone wrong, the answer is just no, and here is exactly why.
 *
 * Rows are named by product, never by id — no UUID reaches the screen (contract §8.7).
 */
export function UndoBlockedPanel({ blocked }: { blocked: UndoBlockedResponse }) {
  return (
    <div role="status" className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-4">
      <h2 className="flex items-start gap-2 text-sm font-semibold text-warning-800">
        <Ban className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {copy.result.undoBlockedTitle}
      </h2>
      <p className="mt-1 pl-6 text-sm text-warning-700">{blocked.message}</p>
      <ul className="mt-3 flex flex-col gap-1.5 pl-6">
        {blocked.blockers.map((blocker) => (
          <li
            key={`${blocker.excelRow}-${blocker.label}`}
            className="flex flex-wrap items-baseline gap-x-2 text-sm text-warning-800"
          >
            <span className="font-medium">{blocker.label}</span>
            <span className="text-xs text-warning-700">
              {copy.result.undoBlockedRow(blocker.excelRow)} · {blocker.reason}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
