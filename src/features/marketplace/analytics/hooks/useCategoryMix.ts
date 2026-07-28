import { marketplaceAnalyticsApi } from '@/features/marketplace/analytics/api/marketplaceAnalyticsApi'
import { useAnalyticsResource } from '@/features/marketplace/analytics/hooks/useAnalyticsResource'
import type { AnalyticsRangeParams, CategoryMix } from '@/features/marketplace/analytics/types'

export function useCategoryMix(params: AnalyticsRangeParams) {
  return useAnalyticsResource<AnalyticsRangeParams, CategoryMix>(marketplaceAnalyticsApi.categoryMix, params)
}
