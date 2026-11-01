import { useState, type ReactNode } from 'react'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/useToast'
import { useWorkingBranch } from '@/features/branches/useWorkingBranch'
import { MoveEditor, type Moved } from '@/features/moves/MoveEditor'
import { useMoveIntent } from '@/features/moves/moveIntent'
import { movesApi } from '@/features/moves/movesApi'
import { applyMoveResult, discardOp, getOutboxState, isInFlight } from '@/features/outbox/outboxStore'
import { requestsApi } from '@/features/requests/requestsApi'
import type { StockRequest } from '@/features/requests/types'
import { isAppError } from '@/types/api'

/**
 * Move stock from Inventory and the product page (owner, 2026-10-30): a Sheet, like Stock in and Stock
 * out - a side panel on a laptop, a bottom sheet on a phone - and, once moved, the same toast with Undo,
 * not a screen of its own.
 */
export function useMoveSheet(): {
  /** Opens Move - or, for someone who mostly asks, Ask (Part 5); `intent` chooses. */
  open: (productIds?: string[], intent?: 'move' | 'ask') => void
  /** Move what a request asked for (Part 5): the route and its lines filled in. */
  openRequest: (request: StockRequest) => void
  sheet: ReactNode
} {
  const [opened, setOpened] = useState<{
    productIds: string[]
    key: number
    request?: StockRequest
    intent: 'move' | 'ask'
  } | null>(null)
  const main = useMoveIntent().intent
  const { showToast } = useToast()
  const { isMultiBranch, working } = useWorkingBranch()

  function moved(result: Moved) {
    setOpened(null)
    // Asked (Part 5): sent, Undo takes the request back; kept on this phone, Undo drops it.
    if (result.status === 'asked') {
      const requestId = result.requestId
      const opId = result.opId
      showToast(
        opId ? "Saved on this phone. It's asked when you're connected." : `Asked · ${result.items} · ${result.route}`,
        opId ? 'info' : 'success',
        { action: { label: 'Undo', onAction: () => (opId ? undoQueued(opId) : void takeBack(requestId)) } },
      )
      return
    }
    if (result.status === 'answered') {
      showToast(`Told ${result.items}: none in the store`, 'success')
      return
    }
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

  async function takeBack(requestId: string) {
    try {
      await requestsApi.cancel(requestId)
      showToast('Undone · nothing was asked', 'info')
    } catch (error) {
      showToast(isAppError(error) ? error.message : "Couldn't take that back.", 'error')
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
    <MoveEditor
      key={opened.key}
      productIds={opened.productIds}
      request={opened.request}
      intent={opened.intent}
      focusSearch
      onMoved={moved}
    >
      {({ body, action, asking }) => (
        <Sheet
          open
          onClose={() => setOpened(null)}
          title={`${asking ? 'Ask for stock' : 'Move stock'}${isMultiBranch && working ? ` · ${working.name}` : ''}`}
          size="lg"
          footer={action}
        >
          {body}
        </Sheet>
      )}
    </MoveEditor>
  )
  return {
    open: (productIds = [], intent = main) => setOpened({ productIds, key: Date.now(), intent }),
    openRequest: (request) => setOpened({ productIds: [], key: Date.now(), request, intent: 'move' }),
    sheet,
  }
}
