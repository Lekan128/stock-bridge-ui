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
