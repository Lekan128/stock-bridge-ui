import { api } from '@/api/client'
import type {
  AnalyticsDateRangeParams,
  AnalyticsSummary,
  Granularity,
  MovementsOverTimePoint,
  TopProductEntry,
  TopProductsDirection,
  TopProductsMetric,
} from '@/components/analytics/types'

export const analyticsApi = {
  summary: (params: AnalyticsDateRangeParams) =>
    api.get<AnalyticsSummary>('/api/analytics/summary', { params }).then((r) => r.data),

  movementsOverTime: (params: AnalyticsDateRangeParams & { granularity: Granularity }) =>
    api.get<MovementsOverTimePoint[]>('/api/analytics/movements-over-time', { params }).then((r) => r.data),

  topProducts: (
    params: AnalyticsDateRangeParams & { by: TopProductsMetric; direction: TopProductsDirection; limit?: number },
  ) => api.get<TopProductEntry[]>('/api/analytics/top-products', { params }).then((r) => r.data),
}
