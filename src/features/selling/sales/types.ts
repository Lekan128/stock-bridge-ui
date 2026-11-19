import type { SalePaymentMethod } from '@/features/selling/sale/payment'

/**
 * The Sales report (`GET /api/analytics/sales`) and one sale (`GET /api/sales/{id}`) - plan §4.7,
 * §6.11. Money is in naira. The API omits null fields, so every nullable one is optional here and is
 * tested with `== null`.
 */

/** 'branch': one row per branch, in "All branches" (MULTI_BRANCH_UX_PLAN.md §4.3). */
export type SalesGrouping = 'sale' | 'product' | 'day' | 'user' | 'category' | 'branch'

/** The leak filters, and the two "Fix these" lists. One at a time. */
export type SalesFilter = 'belowUsualPrice' | 'belowCost' | 'cancelled' | 'unpriced' | 'noCost'

export interface SalesTotals {
  saleCount: number
  lineCount: number
  /** What every priced line went for: the food and drinks, without charges and taxes, even those in the prices. */
  salesAmount: number
  /** What the lines with both a price and a cost went for - profit is only over these. */
  profitKnownSalesAmount?: number
  costAmount?: number
  grossProfit?: number
  /** 0.16 is 16%. Absent with no such lines. */
  margin?: number
  unpricedLineCount: number
  unknownCostLineCount: number
  cancelledLineCount: number
  belowUsualPriceLineCount: number
  belowCostLineCount: number
  /**
   * What came in by each way of paying (API V88): the money itself, charges on top included and a split bill part by
   * part, when the whole of each sale is in view; the food and drinks when narrowed to a product or an area.
   */
  byPayment?: PaymentTotals
  /** Charges and taxes on these sales, kept apart from the food and drinks (V100); only when the whole of each sale is in view. */
  charges?: { name: string; included: boolean; amount: number }[]
}

/** The sales amount split by how the customer paid; "not recorded" is a sale from before payments. */
export interface PaymentTotals {
  cashAmount: number
  cashSales: number
  transferAmount: number
  transferSales: number
  cardAmount: number
  cardSales: number
  notRecordedAmount: number
  notRecordedSales: number
  /** Step 12 (API V96): transfers by the account they came into, most first; absent where none was named. */
  transferAccounts?: { accountId: string; bankName: string; accountNumber: string; amount: number; sales: number }[]
}

export interface SalesReportRow {
  /** Sale id, product id, ISO day, user id, category id; absent for no person or no category. */
  key?: string
  /** The product, the person, the day; for a sale, who recorded it. */
  label?: string
  /** Product rows: how much went, in `unitOfMeasure`. */
  quantity?: number
  unitOfMeasure?: string
  /** Sale rows: when. */
  occurredAt?: string
  /** Sale rows: the products in it ("Rice, Soap"). */
  detail?: string
  /** Sale rows at a multi-branch company: where it was recorded. */
  branch?: string
  /** Sale rows: how the customer paid; absent for a sale from before payments were recorded. */
  paymentMethod?: SalePaymentMethod
  /** Sale rows: where cancelling it has got to (API V89). */
  cancelState?: SaleCancelState
  cancelReason?: SaleCancelReason
  cancelledByName?: string
  cancelRequestedByName?: string
  totals: SalesTotals
  /** Step 12: the account a transfer sale came into. */
  paymentAccountName?: string
  /** Sale rows (V100): charges and taxes added on top - the customer paid the total plus this. */
  chargesOnTop?: number
  /** Sale rows: charges and taxes that were in the prices; the total leaves them out, so the customer paid it plus both. */
  chargesInPrices?: number
}

export interface SalesReport {
  from: string
  to: string
  groupBy: SalesGrouping
  rows: SalesReportRow[]
  truncated: boolean
  totals: SalesTotals
}

export interface SalesReportParams {
  from: string
  to: string
  groupBy: SalesGrouping
  filter?: SalesFilter | null
  productId?: string
}

export type CostBasis = 'FIFO' | 'AVERAGE' | 'UNKNOWN' | 'ESTIMATE'

export interface SaleLineDetail {
  movementId: string
  productId: string
  productName: string
  /** In the product's stock unit. */
  quantity: number
  enteredUnit?: string
  enteredQuantity?: number
  unitPriceAtTime?: number
  enteredUnitPrice?: number
  saleAmount?: number
  costAmount?: number
  costBasis?: CostBasis
  cancelled: boolean
  cancelledAt?: string
  cancelledByName?: string
  priceAdded: boolean
  occurredAt: string
  /** The product's stock unit code ("PIECE", "KG") - what `quantity` counts. */
  unitOfMeasure?: string
  /** A table bill's side (V99): the line of the meal it goes with. */
  withLineId?: string
  /** A table bill line's note for the kitchen. */
  note?: string
  /** Taken off a table's bill: NOT_MADE (stock back) or SENT_BACK (used, not charged). */
  takenOff?: 'NOT_MADE' | 'SENT_BACK'
}

export interface SaleDetail {
  saleId: string
  occurredAt: string
  recordedByUserId?: string
  recordedByName?: string
  lines: SaleLineDetail[]
  total: number
  lineCount: number
  cancelledLineCount: number
  unpricedLineCount: number
  /** How the customer paid; absent for a sale from before payments were recorded. */
  paymentMethod?: SalePaymentMethod
  /** Where it was sold, at a company with several branches. */
  branchName?: string
  /** The account a transfer came into ("GTBank"), Step 12. Never on the receipt. */
  paymentAccountName?: string
  /** Cancelling (API V89): asked and waiting, declined (the sale stands), or the whole sale cancelled. */
  cancelState?: SaleCancelState
  cancelReason?: SaleCancelReason
  cancelNote?: string
  cancelRequestedByName?: string
  cancelRequestedAt?: string
  /** Who cancelled it, or declined the request. */
  cancelDecidedByName?: string
  cancelDecidedAt?: string
  /** A table's bill (V99): "Table 5", "VIP", or the name it was opened for. */
  billFor?: string
  /** Its charges and taxes as they stood when it was made (V100), with what each came to. */
  charges?: import('@/features/selling/charges').SaleCharge[]
  /** What the customer paid: `total` (the food and drinks) plus every charge added on top. */
  totalToPay?: number
  /** A table's bill: each part it was paid in (several when split, V101). */
  payments?: { method: 'CASH' | 'TRANSFER' | 'CARD'; amount: number }[]
}

export type SaleCancelState = 'REQUESTED' | 'DECLINED' | 'CANCELLED'
export type SaleCancelReason = 'WRONG_ITEM' | 'WRONG_AMOUNT' | 'CHANGED_MIND' | 'OTHER'
