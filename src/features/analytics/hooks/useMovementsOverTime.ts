import { queryKeys } from '@/data/queryKeys'
import { useApiQuery } from '@/data/useApiQuery'
import { analyticsApi } from '@/features/analytics/api/analyticsApi'
import type { AnalyticsDateRangeParams, Granularity, MovementsOverTimePoint } from '@/components/analytics/types'

export function useMovementsOverTime(params: AnalyticsDateRangeParams & { granularity: Granularity }) {
  const result = useApiQuery<MovementsOverTimePoint[]>({
    queryKey: queryKeys.analytics.movements(params),
    queryFn: () => analyticsApi.movementsOverTime(params),
    fallbackError: 'Something went wrong. Please try again.',
    keepPrevious: true,
  })

  // When the figures were true, and whether they are the phone's saved copy — for the dashboard's
  // "as of" line (C5, Pattern C: every number shows its freshness).
  return {
    data: result.data ?? null,
    loading: result.loading,
    error: result.error,
    updatedAt: result.updatedAt,
    showingSaved: result.showingSaved,
  }
}
