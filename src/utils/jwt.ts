/**
 * Client-side JWT payload decode only — no signature verification. Safe for reading
 * display claims (username, role) after a token refresh; the server is still the sole
 * authority on whether the token is actually valid.
 */
export function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    )
    return JSON.parse(json) as T
  } catch {
    return null
  }
}

export interface TenantAccessTokenClaims {
  sub: string
  aud: string[]
  clientId: string
  username: string
  role: string
  permissions: string[]
  iat: number
  exp: number
}

export interface SuperAdminAccessTokenClaims {
  sub: string
  aud: string[]
  iat: number
  exp: number
}
