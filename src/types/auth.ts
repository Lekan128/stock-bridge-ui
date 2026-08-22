export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresInSeconds: number
}

/**
 * What kind of account the caller's company is — `clients.client_type`.
 *
 * Orthogonal to `platformOwner`: ProcurePal is a COMPANY that owns the platform, so a check
 * for one tells you nothing about the other. Render-only, like every claim on this object —
 * the server re-reads the clients row on every request and is the sole authority.
 */
export type ClientType = 'COMPANY' | 'VENDOR'

export interface TenantUser {
  id: string
  username: string
  role: string
  permissions: string[]
  clientName: string
  clientIdentifier: string
  /**
   * True when the caller's tenant is ProcurePal itself (`clients.is_platform_owner`). This is a
   * property of the *company*, not the user, and it gates the marketplace-admin screens.
   *
   * Optional so the UI keeps working against an API that has not shipped the field yet — an
   * absent flag degrades to "not the platform owner", which is the safe default.
   */
  platformOwner?: boolean
  /**
   * COMPANY or VENDOR, for the caller's tenant. Decides which workspace they get: a vendor
   * sells and does not buy, so the buyer nav, the cart and checkout are not theirs.
   *
   * Optional for the same reason `platformOwner` is — an API that has not shipped the field
   * degrades to COMPANY, which is the pre-vendor behaviour and the safe default (a buyer
   * denied a vendor screen is an inconvenience; a vendor handed a buyer screen is a bug the
   * server would refuse anyway).
   */
  clientType?: ClientType
}

export interface SuperAdminUser {
  id: string
  username: string
}

export interface TenantLoginResponse {
  tokens: AuthTokens
  user: TenantUser
}

export interface SuperAdminLoginResponse {
  tokens: AuthTokens
  admin: SuperAdminUser
}

export interface TenantLoginRequest {
  clientIdentifier: string
  username: string
  password: string
}

export interface SuperAdminLoginRequest {
  username: string
  password: string
}

export interface ClientSignupRequest {
  name: string
  clientIdentifier?: string
  adminEmail: string
  password: string
  confirmPassword: string
}
