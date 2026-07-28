import { api } from '@/api/client'
import type {
  AnalyticsRangeParams,
  CategoryMix,
  CustomerMetric,
  FulfilmentFunnel,
  Granularity,
  MarketplaceAnalyticsSummary,
  ProductMetric,
  RevenuePoint,
  TopCustomerEntry,
  TopSellingProductEntry,
} from '@/features/marketplace/analytics/types'

/**
 * ProcurePal's marketplace reporting API.
 *
 * Every route is behind two independent server-side gates — the
 * VIEW_MARKETPLACE_ANALYTICS permission AND a platform-owner check — so a 403 from any of
 * these means the operator is signed in as the wrong company, not that something broke.
 * The route is already wrapped in `RequirePlatformOwner`, so in practice that 403 should
 * be unreachable from the UI.
 *
 * No `public: true`: these must go through the shared refresh-and-retry cycle.
 *
 * Six calls rather than one bundle, deliberately — the page's controls move
 * independently, and a single endpoint would turn every toggle into a full-page reload.
 */
const BASE = '/api/marketplace/admin/analytics'

export const marketplaceAnalyticsApi = {
  summary: (params: AnalyticsRangeParams) =>
    api.get<MarketplaceAnalyticsSummary>(`${BASE}/summary`, { params }).then((r) => r.data),

  revenueOverTime: (params: AnalyticsRangeParams & { granularity: Granularity }) =>
    api.get<RevenuePoint[]>(`${BASE}/revenue-over-time`, { params }).then((r) => r.data),

  topCustomers: (params: AnalyticsRangeParams & { metric: CustomerMetric; limit: number }) =>
    api.get<TopCustomerEntry[]>(`${BASE}/top-customers`, { params }).then((r) => r.data),

  topProducts: (params: AnalyticsRangeParams & { metric: ProductMetric; limit: number }) =>
    api.get<TopSellingProductEntry[]>(`${BASE}/top-products`, { params }).then((r) => r.data),

  categoryMix: (params: AnalyticsRangeParams) =>
    api.get<CategoryMix>(`${BASE}/category-mix`, { params }).then((r) => r.data),

  fulfilmentFunnel: (params: AnalyticsRangeParams) =>
    api.get<FulfilmentFunnel>(`${BASE}/fulfilment-funnel`, { params }).then((r) => r.data),
}
