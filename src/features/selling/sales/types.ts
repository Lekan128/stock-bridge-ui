/**
 * The Sales report (`GET /api/analytics/sales`) and one sale (`GET /api/sales/{id}`) - plan §4.7,
 * §6.11. Money is in naira. The API omits null fields, so every nullable one is optional here and is
 * tested with `== null`.
 */

export type SalesGrouping = 'sale' | 'product' | 'day' | 'user'

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
}

export interface SalesReportRow {
  /** Sale id, product id, ISO day, user id; absent for a sale with no person. */
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
}
