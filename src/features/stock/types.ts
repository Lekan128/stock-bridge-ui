import type { MovementType } from '@/features/products/types'

/**
 * The stock in/out report — `GET /api/stock/movements` and its `/summary` sibling.
 *
 * Lives beside the movement rows it filters rather than under `features/analytics`, because this
 * is the raw ledger (prices, suppliers, row by row) rather than an aggregate, and the API gates it
 * on MANAGE_INVENTORY rather than VIEW_ANALYTICS for exactly that reason.
 */
export interface StockMovementReportParams {
  /**
   * ⚠️ Brackets `occurredAt` server-side — when the delivery or sale HAPPENED, not when somebody
   * keyed it in. A month's report therefore contains last month's deliveries entered today, which
   * is what an invoice reconciles against. ISO offset-datetime strings.
   */
  from?: string
  to?: string
  movementType?: MovementType
  productId?: string
  companyVendorId?: string
  page?: number
  size?: number
  /** Spring Data sort, e.g. `occurredAt,desc`. Defaults server-side to newest-occurring first. */
  sort?: string
}

/**
 * The totals row, summed by the database over the WHOLE filtered set — not over the page being
 * viewed. Same filters as the rows above it; if the two ever diverge the footer starts
 * contradicting the table.
 */
export interface StockMovementSummary {
  /** Money on priced IN movements. Always a number — zero when nothing qualifies. */
  inValue: number
  outValue: number
  /** Units received, priced or not, each in its own product's stock unit. */
  inQuantity: number
  outQuantity: number
  inMovementCount: number
  outMovementCount: number
  /**
   * Movements in range with no price on file. These are the reason `inQuantity` can look large
   * against a smaller `inValue` — without showing the count, the only available reading of that
   * gap is "the report is wrong".
   */
  unpricedInCount: number
  unpricedOutCount: number
  /**
   * Counted, never valued. A stock-take correction is not a purchase and not a sale, so it
   * contributes to neither value nor quantity — but it is often the cause of a discrepancy
   * somebody is trying to explain, so it is reported.
   */
  adjustmentCount: number
}
