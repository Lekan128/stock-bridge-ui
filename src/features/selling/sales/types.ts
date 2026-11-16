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
  /** What every priced line went for. */
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
  /** What came in by each way of paying (API V88). Absent from an API older than selling till Step 1. */
  byPayment?: PaymentTotals
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
  totals: SalesTotals
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

export type CostBasis = 'FIFO' | 'AVERAGE' | 'UNKNOWN'

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
}
