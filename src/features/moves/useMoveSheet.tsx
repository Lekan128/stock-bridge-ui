import { useState, type ReactNode } from 'react'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/useToast'
import { useWorkingBranch } from '@/features/branches/useWorkingBranch'
import { MoveEditor, type Moved } from '@/features/moves/MoveEditor'
import { movesApi } from '@/features/moves/movesApi'
import { applyMoveResult, discardOp, getOutboxState, isInFlight } from '@/features/outbox/outboxStore'
import { isAppError } from '@/types/api'

/**
 * Move stock from Inventory and the product page (owner, 2026-10-30): a Sheet, like Stock in and Stock
 * out - a side panel on a laptop, a bottom sheet on a phone - and, once moved, the same toast with Undo,
 * not a screen of its own.
 */
export function useMoveSheet(): { open: (productIds?: string[]) => void; sheet: ReactNode } {
  const [opened, setOpened] = useState<{ productIds: string[]; key: number } | null>(null)
  const { showToast } = useToast()
  const { isMultiBranch, working } = useWorkingBranch()

  function moved(result: Moved) {
    setOpened(null)
    if (result.status === 'sent') {
      const move = result.move
      showToast(`${result.verb} · ${result.items} · ${result.route}${result.waitingFor ? ` · waiting for the ${result.waitingFor}` : ''}`, 'success', {
        action: { label: 'Undo', onAction: () => void undo(move.id, move.fromAreaName) },
      })
      return
    }
    showToast("Saved on this phone. It goes when you're connected.", 'info', {
      action: { label: 'Undo', onAction: () => undoQueued(result.opId) },
    })
  }

  async function undo(moveId: string, fromName: string) {
    try {
      applyMoveResult(await movesApi.undo(moveId))
      showToast(`Undone · back in the ${fromName}`, 'info')
    } catch (error) {
      showToast(isAppError(error) ? error.message : "Couldn't undo that. Move it back instead.", 'error')
    }
  }

  function undoQueued(opId: string) {
    if (isInFlight(opId) || !getOutboxState().ops.some((op) => op.id === opId)) {
      showToast("It has already gone, so it can't be taken back here. Move it back instead.", 'info')
      return
    }
    void discardOp(opId)
    showToast('Undone · nothing was moved', 'info')
  }

  const sheet = opened && (
    <MoveEditor key={opened.key} productIds={opened.productIds} focusSearch onMoved={moved}>
      {({ body, action }) => (
        <Sheet
          open
          onClose={() => setOpened(null)}
          title={`Move stock${isMultiBranch && working ? ` · ${working.name}` : ''}`}
          size="lg"
          footer={action}
        >
          {body}
        </Sheet>
      )}
    </MoveEditor>
  )
  return { open: (productIds = []) => setOpened({ productIds, key: Date.now() }), sheet }
}
