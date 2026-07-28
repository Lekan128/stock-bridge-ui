import { marketplaceAnalyticsApi } from '@/features/marketplace/analytics/api/marketplaceAnalyticsApi'
import { useAnalyticsResource } from '@/features/marketplace/analytics/hooks/useAnalyticsResource'
import type { AnalyticsRangeParams, MarketplaceAnalyticsSummary } from '@/features/marketplace/analytics/types'

/** Headline figures for the range, plus the preceding range of the same length for deltas. */
export function useMarketplaceSummary(params: AnalyticsRangeParams) {
  return useAnalyticsResource<AnalyticsRangeParams, MarketplaceAnalyticsSummary>(
    marketplaceAnalyticsApi.summary,
    params,
  )
}
