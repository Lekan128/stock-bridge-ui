import type { StockInRequestPayload } from '@/features/products/api/stockApi'
import type { StockOutPayload } from '@/features/products/types'
import type { ReceiptPayload, SendPayload } from '@/features/transfers/types'

/** A stock count as the API takes it (A4): what was on the shelf, in stock units. */
export interface StockCountPayload {
  countedQuantity: number
  note?: string
  /**
   * The branch this was recorded at (V51). Stamped by `submitStockWrite` when the write is made, from
   * the phone's working branch, so a later switch never moves a queued write. Absent at a one-branch
   * company: the server's only branch, and the request exactly what it was before branches.
   */
  branchId?: string
}

/**
 * One stock write waiting on this phone (A4). Its `id` is also the request's Idempotency-Key, so
 * however many times it is sent — a retry after a lost reply, a resend after the app was closed —
 * the server records it once.
 */
export type OutboxOp = {
  id: string
  /**
   * The product it changes. A transfer changes several, so it is keyed by its waybill instead
   * (`transfer:<id>`) and names its products in `keys`.
   */
  productId: string
  /**
   * Everything this write must wait behind (MULTI_BRANCH_BUILD_PLAN.md §7.3): an earlier waiting write
   * sharing any of these goes first. Absent means `[productId]`, every write before transfers.
   */
  keys?: string[]
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
  /** A waybill (UX §5.4). Its `payload.id` is the waybill's own id, made on this phone. */
  | { kind: 'TRANSFER_SEND'; payload: SendPayload; baseDelta: null }
  /** Stock off a waybill (UX §5.5). `payload.id` is the receipt's id; `transferId` the waybill's. */
  | { kind: 'TRANSFER_RECEIVE'; transferId: string; payload: ReceiptPayload; baseDelta: null }
)

export type OutboxProblem =
  /** Stock-out of more than was there by the time it arrived. */
  | { kind: 'oversell'; message: string; available: number; requested: number; productId?: string }
  /** Anything else the server said no to: product gone, permission removed, invalid entry. */
  | { kind: 'refused'; message: string }

/** What a submitted write became. */
export type SubmitOutcome<R> =
  | { status: 'sent'; response: R }
  /** Saved on this phone; it will be sent when the server can be reached. */
  | { status: 'queued'; op: OutboxOp }
