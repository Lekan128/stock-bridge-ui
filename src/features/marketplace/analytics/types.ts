/**
 * Wire shapes for `/api/marketplace/admin/analytics/*`.
 *
 * Definitions live on the server (see `MarketplacePeriodMetrics` and its siblings) and are
 * summarised here only where a reader of this file would otherwise get the number wrong —
 * chiefly that revenue excludes cancelled and never-paid orders, that product/category
 * revenue is goods-only, and that the funnel is the one place cancellations are counted.
 *
 * ⚠️ The API sets `spring.jackson.default-property-inclusion: non_null`, so a nullable
 * field is OMITTED from the JSON rather than sent as null. Everything optional below is
 * typed `?: T` and must be guarded with `== null` / a falsy check — never `=== null`.
 */

export type Granularity = 'DAY' | 'WEEK' | 'MONTH'
export type CustomerMetric = 'REVENUE' | 'ORDERS'
export type ProductMetric = 'REVENUE' | 'QUANTITY'

export interface AnalyticsRangeParams {
  from: string
  to: string
}

/** One window's headline figures. The summary endpoint returns two of these. */
export interface MarketplacePeriodMetrics {
  /** Goods + delivery, on orders that are neither CANCELLED nor PENDING_PAYMENT. */
  grossRevenue: number
  /** The goods half of grossRevenue — what the product and category charts sum to. */
  merchandiseRevenue: number
  deliveryFeeRevenue: number
  /** The part of grossRevenue already marked PAID. gross − collected is what is still owed. */
  collectedRevenue: number
  orderCount: number
  averageOrderValue: number
  unitsSold: number
  activeBuyingCompanies: number
  /** First-EVER order landed in this window — not merely first-in-window. */
  newBuyingCompanies: number
  /** 0..1. Share of this window's orders placed by a company that had bought before. */
  repeatOrderRate: number
  /** Still PLACED/CONFIRMED/PROCESSING/OUT_FOR_DELIVERY — owed and not yet handed over. */
  outstandingOrderCount: number
  outstandingOrderValue: number
  /** Pay-on-delivery orders whose cash has not been reconciled yet. */
  payOnDeliveryOrderCount: number
  payOnDeliveryExposure: number
  cancelledOrderCount: number
  cancelledOrderValue: number
  /** Monnify checkouts created and never completed. Excluded from every revenue figure. */
  abandonedCheckoutCount: number
}

export interface MarketplaceAnalyticsSummary {
  from: string
  to: string
  /** The comparison window: same length, ending exactly where this one starts. */
  previousFrom: string
  previousTo: string
  current: MarketplacePeriodMetrics
  previous: MarketplacePeriodMetrics
}

/** Zero-filled by the server, so quiet days are real zeroes rather than missing points. */
export interface RevenuePoint {
  /** Bucket START date, "YYYY-MM-DD". Weeks start Monday, months on the 1st. */
  period: string
  revenue: number
  orderCount: number
  unitsSold: number
  /** Distinct buyers in this bucket — does NOT sum across buckets to the period total. */
  buyingCompanies: number
}

export interface TopCustomerEntry {
  clientId: string
  name: string
  slug: string
  /** In-window. */
  revenue: number
  orderCount: number
  unitsPurchased: number
  /** All-time, ignoring the window entirely. */
  lifetimeSpend: number
  lifetimeOrderCount: number
  firstOrderAt?: string
  lastOrderAt?: string
}

export interface TopSellingProductEntry {
  productId: string
  name: string
  sku: string
  categoryName: string
  /** Line totals only — the per-order delivery fee belongs to no product. */
  revenue: number
  quantitySold: number
  orderCount: number
  buyingCompanies: number
}

export interface CategoryMixEntry {
  /** Absent for the uncategorised slice; `categoryName` is always populated. */
  categoryId?: string
  categoryName: string
  revenue: number
  quantitySold: number
  /** Orders touching this category — sums to more than the period's order count. */
  orderCount: number
  /** 0..1 of `totalRevenue`. */
  share: number
}

export interface CategoryMix {
  totalRevenue: number
  categories: CategoryMixEntry[]
}

export type OrderStatusName =
  | 'PENDING_PAYMENT'
  | 'PLACED'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'RECEIVED'
  | 'CANCELLED'

export interface FunnelStatusCount {
  status: OrderStatusName
  orderCount: number
  /** Includes cancelled and never-paid value — the funnel is the one place that is shown. */
  orderValue: number
}

export interface FunnelStage {
  stage: 'PLACED' | 'CONFIRMED' | 'DISPATCHED' | 'DELIVERED' | 'RECEIVED'
  /** Ever reached this milestone, even if the order has since moved on. */
  orderCount: number
  /** 0..1 against the orders that reached PLACED. */
  conversionRate: number
}

export interface FunnelTransition {
  transition: string
  fromStage: string
  toStage: string
  sampleSize: number
  /** Undefined (not zero) when nothing completed the hop — an average of nothing is not 0h. */
  averageHours?: number
  medianHours?: number
}

export interface FulfilmentFunnel {
  /** Every order in the window, cancellations and abandoned checkouts included. */
  totalOrders: number
  statusCounts: FunnelStatusCount[]
  stages: FunnelStage[]
  transitions: FunnelTransition[]
}
