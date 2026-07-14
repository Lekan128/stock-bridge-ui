import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { superAdminAuthApi } from '@/api/superAdminAuthApi'
import { setSuperAdminAccessToken, setSuperAdminAuthFailureHandler } from '@/api/superAdminClient'
import type { SuperAdminLoginRequest } from '@/types/auth'
import { decodeJwtPayload, type SuperAdminAccessTokenClaims } from '@/utils/jwt'
import { superAdminAuthStorage } from '@/utils/storage'

export interface SuperAdminUser {
  id: string
  username?: string
}

export interface SuperAdminAuthContextValue {
  admin: SuperAdminUser | null
  isAuthenticated: boolean
  isBootstrapping: boolean
  login: (payload: SuperAdminLoginRequest) => Promise<void>
  logout: () => Promise<void>
}

export const SuperAdminAuthContext = createContext<SuperAdminAuthContextValue | null>(null)

// Deliberately separate from AuthProvider (tenant) — own state, own storage key, own axios
// instance (see api/superAdminClient.ts) — so a tenant session and a super-admin session can
// both be live in the same browser without either login/logout touching the other.
export function SuperAdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<SuperAdminUser | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(true)

  useEffect(() => {
    setSuperAdminAuthFailureHandler(() => setAdmin(null))

    async function bootstrap() {
      const refreshToken = superAdminAuthStorage.getRefreshToken()

      if (!refreshToken) {
        setIsBootstrapping(false)
        return
      }

      try {
        const tokens = await superAdminAuthApi.refresh(refreshToken)
        setSuperAdminAccessToken(tokens.accessToken)
        superAdminAuthStorage.setRefreshToken(tokens.refreshToken)
        const claims = decodeJwtPayload<SuperAdminAccessTokenClaims>(tokens.accessToken)
        setAdmin({ id: claims?.sub ?? '' })
      } catch {
        setSuperAdminAccessToken(null)
        superAdminAuthStorage.clearSession()
        setAdmin(null)
      } finally {
        setIsBootstrapping(false)
      }
    }

    void bootstrap()

    return () => setSuperAdminAuthFailureHandler(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function login(payload: SuperAdminLoginRequest) {
    const { tokens, admin: superAdmin } = await superAdminAuthApi.login(payload)
    setSuperAdminAccessToken(tokens.accessToken)
    superAdminAuthStorage.setRefreshToken(tokens.refreshToken)
    setAdmin({ id: superAdmin.id, username: superAdmin.username })
  }

  async function logout() {
    const refreshToken = superAdminAuthStorage.getRefreshToken()

    if (refreshToken) {
      try {
        await superAdminAuthApi.logout(refreshToken)
      } catch {
        // Best-effort — the local session is cleared regardless of server response.
      }
    }

    setSuperAdminAccessToken(null)
    superAdminAuthStorage.clearSession()
    setAdmin(null)
  }

  const value = useMemo<SuperAdminAuthContextValue>(
    () => ({
      admin,
      isAuthenticated: admin !== null,
      isBootstrapping,
      login,
      logout,
    }),
    [admin, isBootstrapping],
  )

  return <SuperAdminAuthContext.Provider value={value}>{children}</SuperAdminAuthContext.Provider>
}
