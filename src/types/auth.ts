export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresInSeconds: number
}

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
