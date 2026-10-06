import { useSyncExternalStore } from 'react'
import { getOutboxState, subscribeOutbox, type OutboxState } from '@/features/outbox/outboxStore'
import type { OutboxOp } from '@/features/outbox/types'

export function useOutboxState(): OutboxState {
  return useSyncExternalStore(subscribeOutbox, getOutboxState, getOutboxState)
}

export interface PendingStock {
  /** Net stock-in minus stock-out waiting to send, in stock units. */
  delta: number
  /** The latest count waiting to send, if any. */
  count: Extract<OutboxOp, { kind: 'COUNT' }> | null
  /** How many writes for this product are waiting (including ones that need attention). */
  waiting: number
  needsAttention: boolean
}

/** What is waiting to be sent for one product — shown beside, never inside, its stock figure. */
export function usePendingStock(productId: string | undefined): PendingStock {
  const { ops } = useOutboxState()
  let delta = 0
  let count: PendingStock['count'] = null
  let waiting = 0
  let needsAttention = false
  for (const op of ops) {
    if (op.productId !== productId) continue
    waiting += 1
    if (op.status === 'needs_attention') needsAttention = true
    if (op.kind === 'COUNT') count = op
    else delta += op.baseDelta
  }
  return { delta, count, waiting, needsAttention }
}
