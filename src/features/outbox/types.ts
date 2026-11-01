import type { StockInRequestPayload } from '@/features/products/api/stockApi'
import type { StockOutPayload } from '@/features/products/types'
import type { ReceiptPayload, SendPayload } from '@/features/transfers/types'
import type { AreaMoveConfirmPayload, AreaMovePayload, AreaReturnPayload } from '@/features/moves/types'
import type { StockRequestPayload } from '@/features/requests/types'

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
  /**
   * The area of that branch it happened in (V60): chosen on the sheet at a branch with two or more
   * areas that keep stock. Absent otherwise - the server's only area, or its delivery area for stock in.
   */
  areaId?: string
  /** What a shortfall is, for this count only (Part 3.5); absent: what the area says. */
  shortAs?: 'USED' | 'MISSING'
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
  /** Stock moved between two areas of a branch (STOCK_AREAS_PART_2.md). `payload.id` is the move's own id. */
  | { kind: 'AREA_MOVE'; payload: AreaMovePayload; baseDelta: null }
  /** What an area that confirms got of a move (STOCK_AREAS_PART_4.md). `moveId` is the move's id. */
  | { kind: 'AREA_MOVE_CONFIRM'; moveId: string; payload: AreaMoveConfirmPayload; baseDelta: null }
  /** Given back or reported by an area that uses stock up (STOCK_AREAS_PART_6.md). `payload.id` is its own id. */
  | { kind: 'AREA_RETURN'; moveId: string; payload: AreaReturnPayload; baseDelta: null }
  /** One area asking another for stock (STOCK_AREAS_PART_5.md). `payload.id` is the request's own id. */
  | { kind: 'STOCK_REQUEST'; payload: StockRequestPayload; baseDelta: null }
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
