import { queryKeys } from '@/data/queryKeys'
import { useApiQuery } from '@/data/useApiQuery'
import { analyticsApi } from '@/features/analytics/api/analyticsApi'
import type { AnalyticsDateRangeParams, TopProductEntry, TopProductsDirection, TopProductsMetric } from '@/components/analytics/types'

export function useTopProducts(params: AnalyticsDateRangeParams & { by: TopProductsMetric; direction: TopProductsDirection; limit?: number }) {
  const result = useApiQuery<TopProductEntry[]>({
    queryKey: queryKeys.analytics.topProducts(params),
    queryFn: () => analyticsApi.topProducts(params),
    fallbackError: 'Something went wrong. Please try again.',
    keepPrevious: true,
  })

  return { data: result.data ?? null, loading: result.loading, error: result.error }
}
