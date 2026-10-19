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
