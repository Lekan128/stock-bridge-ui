import type { StockInRequestPayload } from '@/features/products/api/stockApi'
import type { StockOutPayload } from '@/features/products/types'

/** A stock count as the API takes it (A4): what was on the shelf, in stock units. */
export interface StockCountPayload {
  countedQuantity: number
  note?: string
}

/**
 * One stock write waiting on this phone (A4). Its `id` is also the request's Idempotency-Key, so
 * however many times it is sent — a retry after a lost reply, a resend after the app was closed —
 * the server records it once.
 */
export type OutboxOp = {
  id: string
  productId: string
  /** For the list of waiting writes, which must make sense without the product loaded. */
  productName: string
  /** "20 bags (1,000 kg)" — exactly what the person typed, for the same list. */
  summary: string
  /** When it was entered: sent as `occurredAt`, so the ledger dates it truthfully. */
  createdAt: number
  status: 'pending' | 'needs_attention'
  attempts: number
  /** Not before this (epoch ms): back-off between failed attempts. */
  nextAttemptAt: number
  /** Why the server refused it, once it has. */
  problem?: OutboxProblem
} & (
  | { kind: 'STOCK_IN'; payload: StockInRequestPayload; baseDelta: number }
  | { kind: 'STOCK_OUT'; payload: StockOutPayload; baseDelta: number }
  | { kind: 'COUNT'; payload: StockCountPayload; baseDelta: null }
)

export type OutboxProblem =
  /** Stock-out of more than was there by the time it arrived. */
  | { kind: 'oversell'; message: string; available: number; requested: number }
  /** Anything else the server said no to: product gone, permission removed, invalid entry. */
  | { kind: 'refused'; message: string }

/** What a submitted write became. */
export type SubmitOutcome<R> =
  | { status: 'sent'; response: R }
  /** Saved on this phone; it will be sent when the server can be reached. */
  | { status: 'queued'; op: OutboxOp }
