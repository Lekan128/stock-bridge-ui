import type { TenantUserSummary } from '@/features/users/types'

/**
 * `clients.payment_terms`. Declared here as well as in features/company because the two APIs
 * are separate surfaces that happen to agree today — the same call the codebase already makes
 * for `PageResponse`, which exists independently in features/products and features/users.
 */
export type PaymentTerms = 'PREPAID' | 'PAY_ON_DELIVERY_ALLOWED'

export interface SuperAdminClientSummary {
  id: string
  name: string
  /**
   * The login identifier. The tenant-facing CompanyResponse calls this same column
   * `clientIdentifier`; this surface has called it `slug` since it shipped and keeps doing so.
   * The divergence is deliberate — do not map one name onto the other.
   */
  slug: string
  active: boolean
  adminEmail: string
  userCount: number
  productCount: number
  createdAt: string
}

/**
 * GET /api/superadmin/clients/{id}, and the response to both writes on that row
 * (PUT /{id} and PUT /{id}/status).
 *
 * `phone`, `platformOwner` and `paymentTerms` were appended to the backend record after it
 * first shipped. `platformOwner` and `active` are reported but never accepted — `active` has
 * its own dedicated status endpoint, and there is no API at all for `platformOwner`.
 */
export interface SuperAdminClientDetail extends SuperAdminClientSummary {
  updatedAt: string
  activeUserCount: number
  activeProductCount: number
  lowStockProductCount: number
  phone?: string | null
  platformOwner: boolean
  paymentTerms: PaymentTerms
}

/**
 * PUT /api/superadmin/clients/{id}. Replace semantics for everything except `slug`.
 *
 * `slug` is optional and null/absent means "do not rename" — there is no such thing as
 * clearing it. Renaming it changes what every user of that company types at login, so the UI
 * only ever sends it when an ops user has deliberately opted into a rename (EditClientModal).
 *
 * `active` is NOT here: suspension keeps its own PUT /{id}/status endpoint so a routine profile
 * save can never un-suspend a tenant somebody suspended for a reason.
 */
export interface UpdateClientPayload {
  name: string
  adminEmail: string
  phone: string | null
  paymentTerms: PaymentTerms
  slug?: string
}

/**
 * GET /api/superadmin/clients/{clientId}/users and the platform-owner user endpoints all serve
 * the same `UserSummaryResponse` record that /api/users does, so the tenant type is reused
 * rather than copied — a second declaration could only ever drift out of agreement with it.
 */
export type SuperAdminUserSummary = TenantUserSummary

export interface TenantBreakdownEntry {
  clientId: string
  clientName: string
  active: boolean
  activeUserCount: number
  activeProductCount: number
  stockInValue: number
  stockOutValue: number
}

export interface PlatformAggregateResponse {
  totalActiveClients: number
  totalActiveUsers: number
  totalActiveProducts: number
  totalStockInValue: number
  totalStockOutValue: number
  tenantBreakdown: TenantBreakdownEntry[]
}

export type ClientStatusFilter = 'all' | 'active' | 'suspended'

export interface ClientListParams {
  search?: string
  active?: boolean
  page?: number
  size?: number
}

/** Both super-admin user listings are plain paginated reads — no search or filter server-side. */
export interface AdminUserListParams {
  page?: number
  size?: number
}
