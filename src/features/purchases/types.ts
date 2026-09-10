/**
 * "Everything this company has bought" — the company-wide feed at `/app/purchases`, and the
 * per-vendor screen at `/app/vendors/:id/purchases`, which is the same query narrowed to one
 * supplier.
 *
 * ⚠️ Null fields are omitted from the JSON entirely (`default-property-inclusion: non_null`), so
 * every nullable field is typed optional rather than `| null` — same as the vendors feature.
 */
import type { OrderStatus } from '@/constants/orderStatus'

/**
 * Which of the two ledgers an entry came from.
 *
 * MARKETPLACE_ORDER — a placed order against a ProcurePaddy seller. `orderNumber`, `status` and
 * `paymentStatus` are only ever set on these.
 *
 * MANUAL_STOCK_IN — a delivery entered by hand against a supplier, on or off platform. This is
 * the ONLY way an EXTERNAL supplier ever appears here, since they have no seller account to place
 * an order against. `note` is only ever set on these.
 */
export type PurchaseSource = 'MARKETPLACE_ORDER' | 'MANUAL_STOCK_IN'

export interface PurchaseHistoryLine {
  /** MARKETPLACE_ORDER only. */
  orderItemId?: string
  /** MANUAL_STOCK_IN only. */
  stockMovementId?: string
  buyerProductId?: string
  productName: string
  productSku: string
  unitOfMeasure?: string
  unitPrice?: number
  quantity: number
  receivedQuantity: number
  lineTotal?: number
}

/**
 * One row of purchase history — either a placed marketplace order or a manual stock-in.
 * `source` says which, and which of the other fields are meaningful: `orderNumber`/`status`/
 * `paymentStatus` for a marketplace order, `note` for a manual stock-in. A manual stock-in is
 * always exactly one line, unlike an order, which may bundle several products.
 */
export interface PurchaseHistoryEntry {
  id: string
  source: PurchaseSource
  companyVendorId: string
  /** The supplier's name at the time this was recorded — absent only if the vendor row is gone. */
  vendorName?: string
  orderNumber?: string
  // The OrderStatus union, not a bare string: this feeds OrderStatusBadge, which indexes
  // ORDER_STATUS_LABELS/VARIANTS by it. A widened string would push the failure from compile
  // time to an undefined label in the UI.
  status?: OrderStatus
  paymentStatus?: string
  occurredAt: string
  currency: string
  /**
   * Absent, never 0, when a manual stock-in recorded no price — "we don't know what this cost"
   * and "this cost nothing" are different claims, so this must render as an em dash, not ₦0.00.
   */
  subtotal?: number
  deliveryFee: number
  total?: number
  note?: string
  lines: PurchaseHistoryLine[]
}

export interface PurchaseHistoryParams {
  /** Narrows to one supplier — set by the per-vendor screen, omitted by the company-wide feed. */
  companyVendorId?: string
  source?: PurchaseSource
  from?: string
  to?: string
  page?: number
  size?: number
}
