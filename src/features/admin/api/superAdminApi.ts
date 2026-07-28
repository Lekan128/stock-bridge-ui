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
  AdminUserListParams,
  ClientListParams,
  PlatformAggregateResponse,
  SuperAdminClientDetail,
  SuperAdminClientSummary,
  SuperAdminUserSummary,
  UpdateClientPayload,
} from '@/features/admin/types'
import type { PageResponse } from '@/features/products/types'
import type { CreateUserPayload, ResetPasswordPayload, UpdateUserPayload } from '@/features/users/types'

export const superAdminApiClient = {
  listClients: (params: ClientListParams) =>
    superAdminApi.get<PageResponse<SuperAdminClientSummary>>('/api/superadmin/clients', { params }).then((r) => r.data),

  getClient: (id: string) =>
    superAdminApi.get<SuperAdminClientDetail>(`/api/superadmin/clients/${id}`).then((r) => r.data),

  /** Replace semantics, except `slug` — omit it entirely to leave the login identifier alone. */
  updateClient: (id: string, payload: UpdateClientPayload) =>
    superAdminApi.put<SuperAdminClientDetail>(`/api/superadmin/clients/${id}`, payload).then((r) => r.data),

  updateClientStatus: (id: string, active: boolean) =>
    superAdminApi
      .put<SuperAdminClientDetail>(`/api/superadmin/clients/${id}/status`, { active })
      .then((r) => r.data),

  // --------------------------------------------------------------- Any tenant's users (read-only)
  // There is deliberately no write counterpart: creating an OWNER or resetting a password inside
  // a customer's tenant would be a silent account-takeover capability, so the backend never
  // built it. Do not add one here.

  listClientUsers: (clientId: string, params: AdminUserListParams) =>
    superAdminApi
      .get<PageResponse<SuperAdminUserSummary>>(`/api/superadmin/clients/${clientId}/users`, { params })
      .then((r) => r.data),

  getClientUser: (clientId: string, userId: string) =>
    superAdminApi
      .get<SuperAdminUserSummary>(`/api/superadmin/clients/${clientId}/users/${userId}`)
      .then((r) => r.data),

  // ------------------------------------------------------- ProcurePal's own users (full CRUD)
  // The tenant is named in the path as a word, not carried as an id, because that is the
  // security boundary: no request to these endpoints can be steered at a different tenant.
  //
  // Every one of these answers 409 when no platform owner has been bootstrapped yet — a real
  // state on a fresh deployment, handled by usePlatformOwnerUsers / the page's setup state.

  listPlatformOwnerUsers: (params: AdminUserListParams) =>
    superAdminApi
      .get<PageResponse<SuperAdminUserSummary>>('/api/superadmin/platform-owner/users', { params })
      .then((r) => r.data),

  getPlatformOwnerUser: (userId: string) =>
    superAdminApi.get<SuperAdminUserSummary>(`/api/superadmin/platform-owner/users/${userId}`).then((r) => r.data),

  /**
   * 201. The FIRST user created in an empty ProcurePal tenant becomes the root user and is
   * forced to OWNER whatever role was asked for — always render the returned record rather
   * than assuming the request was honoured verbatim.
   */
  createPlatformOwnerUser: (payload: CreateUserPayload) =>
    superAdminApi.post<SuperAdminUserSummary>('/api/superadmin/platform-owner/users', payload).then((r) => r.data),

  /** PATCH semantics despite the verb — an omitted key is left unchanged. */
  updatePlatformOwnerUser: (userId: string, payload: UpdateUserPayload) =>
    superAdminApi
      .put<SuperAdminUserSummary>(`/api/superadmin/platform-owner/users/${userId}`, payload)
      .then((r) => r.data),

  /** 204. Allowed for the root user too — this is the deliberate lockout-recovery path. */
  resetPlatformOwnerUserPassword: (userId: string, payload: ResetPasswordPayload) =>
    superAdminApi
      .post<void>(`/api/superadmin/platform-owner/users/${userId}/reset-password`, payload)
      .then((r) => r.data),

  /** 204. Deactivates rather than deletes — the row is referenced by stock movements and orders. */
  deactivatePlatformOwnerUser: (userId: string) =>
    superAdminApi.delete<void>(`/api/superadmin/platform-owner/users/${userId}`).then((r) => r.data),

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
