import { isOverdue } from '@/features/expected/expected'
import type { ExpectedDelivery } from '@/features/expected/types'

export type OrderStatus =
  | 'toApprove'
  | 'changeAsked'
  | 'notSent'
  | 'changed'
  | 'sent'
  | 'byPhone'
  | 'part'
  | 'late'
  | 'arrived'
  | 'calledOff'
  | 'closed'

/**
 * One word for where an order stands, said once (DESIGN.md: a state is said once — not a stripe and
 * a badge and a border). The order matters: what needs the buyer's hand comes first.
 */
export function statusOf(order: ExpectedDelivery): OrderStatus {
  // Called off after some of it came: "Closed" — the rest didn't come, what came is in stock.
  if (order.status === 'CANCELLED') return order.lines.some((line) => line.receivedQuantity > 0) ? 'closed' : 'calledOff'
  if (order.status === 'RECEIVED') return 'arrived'
  // Held for approval (V78): nothing else happens to it until someone who can send says yes.
  if (order.approval?.status === 'WAITING') return 'toApprove'
  if (order.approval?.status === 'CHANGE_ASKED') return 'changeAsked'
  // Waiting to be sent: never sent, or sent and changed since (the supplier has an older revision).
  // Anything arrived means the supplier has it, whatever was sent (the server agrees since 2026-11-05).
  if (order.lines.some((line) => line.receivedQuantity > 0)) return 'part'
  if (order.poNumber != null && order.waitingToBeSent) return order.sentVia != null ? 'changed' : 'notSent'
  if (isOverdue(order)) return 'late'
  if (order.sentVia === 'PHONE') return 'byPhone'
  return 'sent'
}
