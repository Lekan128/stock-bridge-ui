export interface AnalyticsSummary {
  totalInValue: number
  totalOutValue: number
  totalUnitsIn: number
  totalUnitsOut: number
  lowStockProductCount: number
  activeProductCount: number
  /** `quantityOnHand <= 0`, active only. Independent of `lowStockProductCount` — a product with no
   *  alert threshold set can be out of stock without ever counting as "low". */
  outOfStockProductCount: number
  /** `activeProductCount` minus every product counted in `lowStockProductCount` or
   *  `outOfStockProductCount` — the count this dashboard had no figure for before. */
  wellStockedProductCount: number
}

export type Granularity = 'day' | 'week' | 'month'

/** period is the bucket start date as "YYYY-MM-DD" (week/month buckets still report their start date). */
export interface MovementsOverTimePoint {
  period: string
  inValue: number
  outValue: number
  inQuantity: number
  outQuantity: number
}

export type TopProductsMetric = 'value' | 'quantity'
export type TopProductsDirection = 'in' | 'out'

export interface TopProductEntry {
  productId: string
  name: string
  sku: string
  value: number
  quantity: number
}

export interface AnalyticsDateRangeParams {
  from?: string
  to?: string
}
