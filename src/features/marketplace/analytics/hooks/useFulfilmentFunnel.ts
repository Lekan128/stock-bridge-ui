import { marketplaceAnalyticsApi } from '@/features/marketplace/analytics/api/marketplaceAnalyticsApi'
import { useAnalyticsResource } from '@/features/marketplace/analytics/hooks/useAnalyticsResource'
import type { AnalyticsRangeParams, FulfilmentFunnel } from '@/features/marketplace/analytics/types'

export function useFulfilmentFunnel(params: AnalyticsRangeParams) {
  return useAnalyticsResource<AnalyticsRangeParams, FulfilmentFunnel>(
    marketplaceAnalyticsApi.fulfilmentFunnel,
    params,
  )
}
