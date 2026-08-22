import { useAnalyticsResource } from '@/features/marketplace/analytics/hooks/useAnalyticsResource'
import { vendorSalesApi } from '@/features/vendor/api/vendorSalesApi'
import type {
  Granularity,
  ProductMetric,
  VendorOrderStatusCount,
  VendorRangeParams,
  VendorRevenuePoint,
  VendorSalesSummary,
  VendorStockOut,
  VendorTopProduct,
} from '@/features/vendor/types'

/**
 * The seller's own-sales hooks.
 *
 * All five reuse `useAnalyticsResource` from the marketplace analytics module rather than
 * re-implementing its fetch loop. That hook is deliberately generic — it takes a fetcher and
 * a params object and knows nothing about either module — and its two behaviours are exactly
 * what this page needs too: `refetch`, so an error state can offer Retry instead of a page
 * reload, and keeping the previous `data` while a new range is in flight, so moving the date
 * control does not strobe every card back to a skeleton. Callers render stale numbers at
 * reduced opacity and fall back to a skeleton only on first load (`loading && !data`).
 */

export function useVendorSalesSummary(params: VendorRangeParams) {
  return useAnalyticsResource<VendorRangeParams, VendorSalesSummary>(vendorSalesApi.summary, params)
}

export function useVendorRevenueOverTime(params: VendorRangeParams & { granularity: Granularity }) {
  return useAnalyticsResource<typeof params, VendorRevenuePoint[]>(vendorSalesApi.revenueOverTime, params)
}

export function useVendorTopProducts(params: VendorRangeParams & { metric: ProductMetric; limit: number }) {
  return useAnalyticsResource<typeof params, VendorTopProduct[]>(vendorSalesApi.topProducts, params)
}

export function useVendorOrderStatusBreakdown(params: VendorRangeParams) {
  return useAnalyticsResource<VendorRangeParams, VendorOrderStatusCount[]>(
    vendorSalesApi.orderStatusBreakdown,
    params,
  )
}

/** No range parameter, unlike its siblings — see the API module. */
export function useVendorStockOuts(limit: number) {
  return useAnalyticsResource<{ limit: number }, VendorStockOut[]>(vendorSalesApi.stockOuts, { limit })
}
