import { useState } from 'react'
import { MoveSheet } from '@/features/moves/MoveSheet'
import { itemsWord } from '@/features/moves/moveWords'
import type { AreaMove } from '@/features/moves/types'
import { useWaitingMoves } from '@/features/moves/useWaitingMoves'

/**
 * "1 item from the Store to confirm · Confirm" (STOCK_AREAS_PART_4.md): one line where the work is - under quick
 * mode's title on a phone, at the top of Inventory on a laptop (owner, 2026-10-31) - and nothing when nothing
 * waits. Confirm opens the move: a bottom sheet on a phone, a side panel on a laptop.
 *
 * @param bar quick mode's full-width bar under its title; otherwise a box like the page's other notices.
 */
export function WaitingMovesLine({ bar = false }: { bar?: boolean }) {
  const { moves } = useWaitingMoves()
  const [open, setOpen] = useState<AreaMove | null>(null)
  if (moves.length === 0 && !open) return null
  return (
    <>
      {moves.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen(moves[0])}
          data-waiting-line
          className={`flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm text-primary-900 ${
            bar
              ? 'border-b border-primary-100 bg-primary-50 px-4'
              : 'rounded-lg border border-primary-200 bg-primary-50 px-4 py-2 hover:bg-primary-100'
          }`}
        >
          <span className="truncate">
            {moves.length === 1
              ? `${itemsWord(moves[0].lines.length)} from the ${moves[0].fromAreaName} to confirm`
              : `${moves.length} moves to confirm`}
          </span>
          <span className="shrink-0 font-semibold text-primary-700">Confirm</span>
        </button>
      )}
      {open && <MoveSheet key={open.id} move={open} onClose={() => setOpen(null)} />}
    </>
  )
}
