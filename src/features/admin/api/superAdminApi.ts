import { superAdminApi } from '@/api/superAdminClient'
import type {
  AnalyticsDateRangeParams,
  AnalyticsSummary,
  Granularity,
  MovementsOverTimePoint,
  TopProductEntry,
  TopProductsDirection,
  TopProductsMetric,
} from '@/components/analytics/types'
import type {
  ClientListParams,
  PlatformAggregateResponse,
  SuperAdminClientDetail,
  SuperAdminClientSummary,
} from '@/features/admin/types'
import type { PageResponse } from '@/features/products/types'

export const superAdminApiClient = {
  listClients: (params: ClientListParams) =>
    superAdminApi.get<PageResponse<SuperAdminClientSummary>>('/api/superadmin/clients', { params }).then((r) => r.data),

  getClient: (id: string) =>
    superAdminApi.get<SuperAdminClientDetail>(`/api/superadmin/clients/${id}`).then((r) => r.data),

  updateClientStatus: (id: string, active: boolean) =>
    superAdminApi
      .put<SuperAdminClientDetail>(`/api/superadmin/clients/${id}/status`, { active })
      .then((r) => r.data),

  clientAnalyticsSummary: (id: string, params: AnalyticsDateRangeParams) =>
    superAdminApi
      .get<AnalyticsSummary>(`/api/superadmin/clients/${id}/analytics/summary`, { params })
      .then((r) => r.data),

  clientMovementsOverTime: (id: string, params: AnalyticsDateRangeParams & { granularity: Granularity }) =>
    superAdminApi
      .get<MovementsOverTimePoint[]>(`/api/superadmin/clients/${id}/analytics/movements-over-time`, { params })
      .then((r) => r.data),

  clientTopProducts: (
    id: string,
    params: AnalyticsDateRangeParams & { by: TopProductsMetric; direction: TopProductsDirection; limit?: number },
  ) =>
    superAdminApi
      .get<TopProductEntry[]>(`/api/superadmin/clients/${id}/analytics/top-products`, { params })
      .then((r) => r.data),

  aggregate: (params: AnalyticsDateRangeParams) =>
    superAdminApi.get<PlatformAggregateResponse>('/api/superadmin/analytics/aggregate', { params }).then((r) => r.data),
}
