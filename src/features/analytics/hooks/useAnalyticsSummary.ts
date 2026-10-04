import { queryKeys } from '@/data/queryKeys'
import { useApiQuery } from '@/data/useApiQuery'
import { analyticsApi } from '@/features/analytics/api/analyticsApi'
import type { AnalyticsDateRangeParams, AnalyticsSummary } from '@/components/analytics/types'

export function useAnalyticsSummary(params: AnalyticsDateRangeParams) {
  const result = useApiQuery<AnalyticsSummary>({
    queryKey: queryKeys.analytics.summary(params),
    queryFn: () => analyticsApi.summary(params),
    fallbackError: 'Something went wrong. Please try again.',
    keepPrevious: true,
  })

  return { data: result.data ?? null, loading: result.loading, error: result.error }
}
