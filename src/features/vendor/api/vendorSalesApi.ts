import { api } from '@/api/client'
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
 * A seller's OWN sales figures.
 *
 * Every route is behind three independent server-side gates — either analytics permission,
 * a seller check on the caller's company, and a `seller_client_id` predicate on every query.
 * A 403 from any of these means the caller is signed in as a company that does not sell, not
 * that something broke; the routes are already behind `RequireSeller`, so it should be
 * unreachable from the UI.
 *
 * No `public: true`: these go through the shared refresh-and-retry cycle like everything else.
 *
 * Separate calls rather than one bundle, matching the marketplace analytics API — the page's
 * controls move independently and a single endpoint would make every toggle a full reload.
 */
const BASE = '/api/vendor/analytics'

export const vendorSalesApi = {
  summary: (params: VendorRangeParams) =>
    api.get<VendorSalesSummary>(`${BASE}/summary`, { params }).then((r) => r.data),

  revenueOverTime: (params: VendorRangeParams & { granularity: Granularity }) =>
    api.get<VendorRevenuePoint[]>(`${BASE}/revenue-over-time`, { params }).then((r) => r.data),

  topProducts: (params: VendorRangeParams & { metric: ProductMetric; limit: number }) =>
    api.get<VendorTopProduct[]>(`${BASE}/top-products`, { params }).then((r) => r.data),

  orderStatusBreakdown: (params: VendorRangeParams) =>
    api.get<VendorOrderStatusCount[]>(`${BASE}/order-status-breakdown`, { params }).then((r) => r.data),

  /** Takes no date range: a stock-out is a fact about now, not about a window. */
  stockOuts: (params: { limit: number }) =>
    api.get<VendorStockOut[]>(`${BASE}/stock-outs`, { params }).then((r) => r.data),
}
