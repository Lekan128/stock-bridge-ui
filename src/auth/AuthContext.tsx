import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi } from '@/api/authApi'
import { setAccessToken, setAuthFailureHandler } from '@/api/client'
import type { ClientSignupRequest, TenantLoginRequest, TenantUser } from '@/types/auth'
import { decodeJwtPayload, type TenantAccessTokenClaims } from '@/utils/jwt'
import { authStorage } from '@/utils/storage'

export interface AuthTenantUser {
  type: 'tenant'
  id: string
  username: string
  role: string
  permissions: string[]
}

export interface AuthClient {
  id?: string
  identifier: string
  name?: string
}

export interface AuthContextValue {
  user: AuthTenantUser | null
  client: AuthClient | null
  isAuthenticated: boolean
  isBootstrapping: boolean
  loginTenant: (payload: TenantLoginRequest) => Promise<void>
  signup: (payload: ClientSignupRequest) => Promise<TenantUser>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthTenantUser | null>(null)
  const [client, setClient] = useState<AuthClient | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(true)

  function clearSessionState() {
    setUser(null)
    setClient(null)
  }

  // Runs once on app load: if a refresh token survived from a previous visit, exchange it
  // for a fresh access token. /refresh only returns tokens (no user object), so tenant
  // display info is reconstructed from the JWT claims; clientName isn't in the token at all,
  // so it falls back to the last-known client identifier until the next full login.
  useEffect(() => {
    setAuthFailureHandler(clearSessionState)

    async function bootstrap() {
      const refreshToken = authStorage.getRefreshToken()

      if (!refreshToken) {
        setIsBootstrapping(false)
        return
      }

      try {
        const tokens = await authApi.tenantRefresh(refreshToken)
        setAccessToken(tokens.accessToken)
        authStorage.setRefreshToken(tokens.refreshToken)
        const claims = decodeJwtPayload<TenantAccessTokenClaims>(tokens.accessToken)
        setUser({
          type: 'tenant',
          id: claims?.sub ?? '',
          username: claims?.username ?? '',
          role: claims?.role ?? '',
          permissions: claims?.permissions ?? [],
        })
        const lastIdentifier = authStorage.getLastClientIdentifier()
        setClient({ id: claims?.clientId, identifier: lastIdentifier ?? '' })
      } catch {
        setAccessToken(null)
        authStorage.clearSession()
        clearSessionState()
      } finally {
        setIsBootstrapping(false)
      }
    }

    void bootstrap()

    return () => setAuthFailureHandler(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loginTenant(payload: TenantLoginRequest) {
    const { tokens, user: tenantUser } = await authApi.tenantLogin(payload)
    authStorage.setLastClientIdentifier(tenantUser.clientIdentifier)
    applyTenantSession(tokens.accessToken, tokens.refreshToken, tenantUser)
  }

  async function signup(payload: ClientSignupRequest): Promise<TenantUser> {
    const { tokens, user: tenantUser } = await authApi.signup(payload)
    authStorage.setLastClientIdentifier(tenantUser.clientIdentifier)
    applyTenantSession(tokens.accessToken, tokens.refreshToken, tenantUser)
    return tenantUser
  }

  function applyTenantSession(accessToken: string, refreshToken: string, tenantUser: TenantUser) {
    setAccessToken(accessToken)
    authStorage.setRefreshToken(refreshToken)
    setUser({
      type: 'tenant',
      id: tenantUser.id,
      username: tenantUser.username,
      role: tenantUser.role,
      permissions: tenantUser.permissions,
    })
    setClient({ identifier: tenantUser.clientIdentifier, name: tenantUser.clientName })
  }

  async function logout() {
    const refreshToken = authStorage.getRefreshToken()

    if (refreshToken) {
      try {
        await authApi.tenantLogout(refreshToken)
      } catch {
        // Best-effort — the local session is cleared regardless of server response.
      }
    }

    setAccessToken(null)
    authStorage.clearSession()
    clearSessionState()
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      client,
      isAuthenticated: user !== null,
      isBootstrapping,
      loginTenant,
      signup,
      logout,
    }),
    [user, client, isBootstrapping],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
