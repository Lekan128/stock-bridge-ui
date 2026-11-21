/** What a company does with its stock - the first-week answer (API V49). */
export type StockUse = 'USE' | 'SELL' | 'BOTH'

/** Which path the selling switch was changed through (API V45). */
export type SettingChangeSource = 'OWNER' | 'SUPPORT' | 'FIRST_WEEK' | 'IN_CONTEXT'

/** `GET /api/company/selling`. Optional fields are absent, not null, when unset (the API omits nulls). */
export interface SellingSettings {
  sellsStock: boolean
  /** False for a marketplace vendor, which cannot choose it: show no switch at all. */
  available: boolean
  changedAt?: string
  /** "Ada Obi", or "ProcurePal support" - never a support account's own name. */
  changedByName?: string
  changedVia?: SettingChangeSource
  stockUse?: StockUse
  /** Products whose only price is an old one set aside before selling existed, waiting for review. */
  legacyPriceCount: number
  legacyPricesDismissed: boolean
  /** "Sell things you make" (API V90): made-here items, under selling. Off until turned on. */
  sellsMadeHere?: boolean
  madeHereChangedAt?: string
  madeHereChangedByName?: string
  /** "Count cash at open and close" (API V97, Step 13). */
  countsCash?: boolean
  countsCashChangedAt?: string
  countsCashChangedByName?: string
  /** How long after a close a drawer can be opened again (V98): 1-24 hours, 4 to start. */
  cashReopenHours?: number
  /** V99: categories whose products are sides - the till asks which meal each goes with. */
  sideCategoryIds?: string[]
  /** V107: "Each branch can have its own prices" (BRANCH_PRICES_PLAN.md). Off: one price at every branch. */
  branchPrices?: boolean
}

export interface UpdateSellingSettingsPayload {
  sellsStock: boolean
  source?: SettingChangeSource
  stockUse?: StockUse
}

/** One product in the old-price review. Prices are per stock unit. */
export interface LegacyPriceRow {
  productId: string
  name: string
  sku: string
  legacyUnitPrice: number
  costPrice?: number
  unitOfMeasure?: string
  packagingUnit?: string
  packagingSize?: number
}

/**
 * A person's own sales over a range (`GET /api/sales/mine/summary`) - the till total. The API sends
 * nothing about cost on this one, so no field for it here either.
 */
export interface MySalesTotals {
  saleCount: number
  lineCount: number
  salesAmount: number
  unpricedLineCount: number
  /** Split by how the customer paid (API V88). */
  byPayment?: import('@/features/selling/sales/types').PaymentTotals
}
