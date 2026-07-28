import { marketplaceAnalyticsApi } from '@/features/marketplace/analytics/api/marketplaceAnalyticsApi'
import { useAnalyticsResource } from '@/features/marketplace/analytics/hooks/useAnalyticsResource'
import type {
  AnalyticsRangeParams,
  ProductMetric,
  TopSellingProductEntry,
} from '@/features/marketplace/analytics/types'

type Params = AnalyticsRangeParams & { metric: ProductMetric; limit: number }

/**
 * Named useTopSellingProducts, not useTopProducts: the tenant dashboard already has a
 * `useTopProducts` that ranks stock MOVEMENTS, and the two must stay distinguishable in
 * an import list.
 */
export function useTopSellingProducts(params: Params) {
  return useAnalyticsResource<Params, TopSellingProductEntry[]>(marketplaceAnalyticsApi.topProducts, params)
}
