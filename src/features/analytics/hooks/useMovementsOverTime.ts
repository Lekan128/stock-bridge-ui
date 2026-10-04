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

  return { data: result.data ?? null, loading: result.loading, error: result.error }
}
