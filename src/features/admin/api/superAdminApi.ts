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
  EscrowHoldSettings,
  ApproveVendorApplicationPayload,
  ClientListParams,
  CreateVendorPayload,
  ModerationCounts,
  ModerationProduct,
  ModerationQueueParams,
  PlatformAggregateResponse,
  PlatformRevenueParams,
  PlatformRevenuePoint,
  PlatformRevenueSummary,
  SellerRevenueBreakdown,
  SellerRevenueSort,
  SuperAdminClientDetail,
  SuperAdminClientSummary,
  RejectVendorApplicationPayload,
  SuperAdminUserSummary,
  SuperAdminVendorDetail,
  SuperAdminVendorSummary,
  UpdateClientPayload,
  UpdateEscrowHoldPayload,
  VendorApplication,
  VendorListParams,
  VendorWaitlistCounts,
  VendorWaitlistParams,
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

  // ------------------------------------------------------------------ Listing moderation (M4)
  // Vendors' products only. The server pins this queue to the vendor-seller set, so a buying
  // company's private inventory can never appear here however the parameters are set — see
  // ModerationProduct. Do not add a parameter that would widen it.

  moderationQueue: (params: ModerationQueueParams) =>
    superAdminApi
      .get<PageResponse<ModerationProduct>>('/api/superadmin/product-moderation/products', { params })
      .then((r) => r.data),

  moderationCounts: () =>
    superAdminApi.get<ModerationCounts>('/api/superadmin/product-moderation/counts').then((r) => r.data),

  approveListing: (id: string) =>
    superAdminApi
      .post<ModerationProduct>(`/api/superadmin/product-moderation/products/${id}/approve`)
      .then((r) => r.data),

  /**
   * The reason is mandatory server-side and the UI must not offer a way around it: a rejection
   * with no reason attached cannot be acted on and simply becomes a support ticket.
   */
  rejectListing: (id: string, reason: string) =>
    superAdminApi
      .post<ModerationProduct>(`/api/superadmin/product-moderation/products/${id}/reject`, { reason })
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

  // -------------------------------------------------------------- Cross-seller revenue (M6)
  // The only place total marketplace revenue exists. ProcurePal's own analytics narrowed to
  // its own sales in M6 — see features/marketplace/analytics/types — and the cross-seller
  // figure moved here, behind the super admin token audience. `superAdminApi` is the client
  // that carries that token; using the tenant `api` client against these paths gets a 403,
  // which is the intended behaviour and not a bug to work around.

  /** Total marketplace revenue for the window, with the preceding window alongside for growth. */
  platformRevenueSummary: (params: PlatformRevenueParams) =>
    superAdminApi
      .get<PlatformRevenueSummary>('/api/superadmin/analytics/revenue/summary', { params })
      .then((r) => r.data),

  /** The growth curve. Zero-filled server-side, so quiet days arrive as real zeroes. */
  platformRevenueOverTime: (params: PlatformRevenueParams & { granularity: 'DAY' | 'WEEK' | 'MONTH' }) =>
    superAdminApi
      .get<PlatformRevenuePoint[]>('/api/superadmin/analytics/revenue/over-time', { params })
      .then((r) => r.data),

  /**
   * Per-seller breakdown. `ascending` is deliberately optional and omitted by default: the
   * server reads its absence as "the natural direction for this sort key" — biggest-first for
   * money and counts, A–Z for name — so the client does not have to encode that policy twice.
   */
  platformRevenueBySeller: (params: PlatformRevenueParams & { sort?: SellerRevenueSort; ascending?: boolean }) =>
    superAdminApi
      .get<SellerRevenueBreakdown>('/api/superadmin/analytics/revenue/by-seller', { params })
      .then((r) => r.data),

  // ------------------------------------------------------------------ Vendor waitlist (M2)
  // The queue a public form feeds. Every call here is a super-admin action: creating a vendor is
  // the ONLY path in the product that grants the VENDOR role, which is deliberately excluded from
  // the assignable-role allow-list so no tenant OWNER can ever mint one.

  vendorApplications: (params: VendorWaitlistParams) =>
    superAdminApi
      .get<PageResponse<VendorApplication>>('/api/superadmin/vendor-waitlist', { params })
      .then((r) => r.data),

  vendorWaitlistCounts: () =>
    superAdminApi.get<VendorWaitlistCounts>('/api/superadmin/vendor-waitlist/counts').then((r) => r.data),

  /**
   * Creates the vendor and stamps the application, in one transaction. Answers with the VENDOR,
   * not the application — the username is what ops needs next in order to tell the business what
   * to log in as.
   *
   * Emphatically not idempotent: a second call is a 409, never a no-op. Approving twice would
   * otherwise create a second client and orphan the first vendor account.
   */
  approveVendorApplication: (id: string, payload: ApproveVendorApplicationPayload) =>
    superAdminApi
      .post<SuperAdminVendorDetail>(`/api/superadmin/vendor-waitlist/${id}/approve`, payload)
      .then((r) => r.data),

  /** The note is mandatory server-side and the UI must not offer a way around it — it IS the email. */
  rejectVendorApplication: (id: string, payload: RejectVendorApplicationPayload) =>
    superAdminApi
      .post<VendorApplication>(`/api/superadmin/vendor-waitlist/${id}/reject`, payload)
      .then((r) => r.data),

  // ------------------------------------------------------------------ Vendor accounts (M2)
  // Narrower than /api/superadmin/clients on purpose: the server resolves these by
  // (id, client_type = VENDOR), so a buying company's id is a 404 here rather than a COMPANY row
  // rendered under a vendor heading.
  //
  // There is deliberately no suspend and no password reset. Suspension is
  // PUT /api/superadmin/clients/{id}/status, which already handles any client and sends the email
  // that goes with it; a second endpoint on the same column is one more place to miss when the
  // rules change. Vendor credentials are a bigger decision — a vendor has exactly one account, so
  // taking it over is taking over the whole business's presence — and the backend has not built it.

  listVendors: (params: VendorListParams) =>
    superAdminApi
      .get<PageResponse<SuperAdminVendorSummary>>('/api/superadmin/vendors', { params })
      .then((r) => r.data),

  getVendor: (id: string) =>
    superAdminApi.get<SuperAdminVendorDetail>(`/api/superadmin/vendors/${id}`).then((r) => r.data),

  /** 201. A business ops recruited offline, with no application behind it. */
  createVendor: (payload: CreateVendorPayload) =>
    superAdminApi.post<SuperAdminVendorDetail>('/api/superadmin/vendors', payload).then((r) => r.data),

  // ------------------------------------------------------------------ Settlement policy (M9)
  // The escrow hold: how long a vendor's confirmed money waits before it can be paid out.
  //
  // There is deliberately no tenant-facing equivalent of either call. A vendor learns the hold
  // that applies to THEIR money from their own statement, which carries the actual maturity
  // dates — a more useful answer than the number — and nobody outside ProcurePaddy gets to poll
  // the platform's policy.

  getEscrowHoldSettings: () =>
    superAdminApi.get<EscrowHoldSettings>('/api/superadmin/settlement/settings').then((r) => r.data),

  /**
   * PUT, and repeating the identical request is a no-op that writes no audit row and mails
   * nobody — which is what PUT promises.
   *
   * Requires the caller's OWN password and an explicit `acknowledged: true`. A 403 means the
   * password did not match and nothing was changed; a 400 means the body was rejected before
   * anything was read. Neither leaves a partial change to clean up.
   */
  updateEscrowHold: (payload: UpdateEscrowHoldPayload) =>
    superAdminApi
      .put<EscrowHoldSettings>('/api/superadmin/settlement/settings/escrow-hold', payload)
      .then((r) => r.data),
}
