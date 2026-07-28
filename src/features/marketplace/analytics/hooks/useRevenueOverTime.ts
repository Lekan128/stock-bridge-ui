import { marketplaceAnalyticsApi } from '@/features/marketplace/analytics/api/marketplaceAnalyticsApi'
import { useAnalyticsResource } from '@/features/marketplace/analytics/hooks/useAnalyticsResource'
import type { AnalyticsRangeParams, Granularity, RevenuePoint } from '@/features/marketplace/analytics/types'

type Params = AnalyticsRangeParams & { granularity: Granularity }

/** Zero-filled server-side, so the caller can plot the array straight through. */
export function useRevenueOverTime(params: Params) {
  return useAnalyticsResource<Params, RevenuePoint[]>(marketplaceAnalyticsApi.revenueOverTime, params)
}
