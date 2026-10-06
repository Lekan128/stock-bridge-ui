import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi } from '@/api/authApi'
import { refreshSession, setAccessToken, setAuthFailureHandler } from '@/api/client'
import { isTransientRefreshFailure } from '@/api/createApiClient'
import type { ClientSignupRequest, ClientType, TenantLoginRequest, TenantLoginResponse, TenantUser } from '@/types/auth'
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
  /** True when this tenant is ProcurePal itself — `clients.is_platform_owner`. */
  platformOwner: boolean
  /**
   * `clients.client_type`. ORTHOGONAL to `platformOwner` — ProcurePal is a COMPANY that
   * happens to own the platform, so neither flag implies anything about the other.
   * Defaults to COMPANY when the API has not sent it.
   */
  clientType: ClientType
}

export interface AuthContextValue {
  user: AuthTenantUser | null
  client: AuthClient | null
  isAuthenticated: boolean
  /**
   * Convenience mirror of `client.platformOwner`, so guards and nav filters don't each have to
   * null-check the client. Never a substitute for the backend's own platform-owner check.
   */
  isPlatformOwner: boolean
  /**
   * Convenience mirror of `client.clientType === 'VENDOR'`, exactly parallel to
   * `isPlatformOwner` and used the same way: it decides what to RENDER. The server's
   * `VendorGuard` re-reads the clients row on every request and is the only thing that
   * decides what may be DONE, so a stale token grants nothing.
   *
   * Note it is false for ProcurePal, which sells but is not a vendor — see `isSeller`.
   */
  isVendor: boolean
  /**
   * "May this tenant sell" — a vendor OR the platform owner. The mirror of the backend's
   * `VendorGuard.requireSeller()`, and the flag almost every selling surface wants: the
   * order queue, the seller catalogue, own-sales analytics and pickup addresses all belong
   * to both. Using `isVendor` for those would hide ProcurePal from its own marketplace,
   * which is the single most likely mistake in this feature.
   */
  isSeller: boolean
  isBootstrapping: boolean
  loginTenant: (payload: TenantLoginRequest) => Promise<void>
  signup: (payload: ClientSignupRequest) => Promise<TenantUser>
  /**
   * Takes a session the API issued some other way: a super admin opening a shop's workspace as
   * Procurepaddy support (LANDING_PAGE_PLAN.md, step 5). Same as a login, without the form.
   */
  adoptTenantSession: (response: TenantLoginResponse) => void
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

/** How often a session restored without the server re-tries its refresh while the page is visible. */
const SESSION_RETRY_MS = 30_000

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthTenantUser | null>(null)
  const [client, setClient] = useState<AuthClient | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(true)

  function clearSessionState() {
    setUser(null)
    setClient(null)
  }

  /** Sets the session in React state and remembers it, so the app can open without the server. */
  function applySession(nextUser: AuthTenantUser, nextClient: AuthClient) {
    setUser(nextUser)
    setClient(nextClient)
    const { type: _type, ...storedUser } = nextUser
    authStorage.setSessionProfile({ user: storedUser, client: nextClient })
  }

  /**
   * /refresh only returns tokens (no user object), so the session is rebuilt from the JWT claims.
   * The company's display name isn't in the token, so it comes from the last session this device
   * saw for the same company, then from the last-known identifier.
   */
  function sessionFromAccessToken(accessToken: string): { user: AuthTenantUser; client: AuthClient } {
    const claims = decodeJwtPayload<TenantAccessTokenClaims>(accessToken)
    const remembered = authStorage.getSessionProfile()?.client
    const sameCompany = remembered != null && remembered.id != null && remembered.id === claims?.clientId
    return {
      user: {
        type: 'tenant',
        id: claims?.sub ?? '',
        username: claims?.username ?? '',
        role: claims?.role ?? '',
        permissions: claims?.permissions ?? [],
      },
      client: {
        id: claims?.clientId,
        identifier: (sameCompany ? remembered.identifier : null) ?? authStorage.getLastClientIdentifier() ?? '',
        name: sameCompany ? remembered.name : undefined,
        platformOwner: claims?.platformOwner === true,
        // An absent claim degrades to COMPANY: a buyer refused a vendor screen is an
        // inconvenience, a vendor shown a buyer screen the server would refuse is a bug.
        clientType: claims?.clientType === 'VENDOR' ? 'VENDOR' : 'COMPANY',
      },
    }
  }

  // Runs once on app load: if a refresh token survived from a previous visit, exchange it for a
  // fresh access token.
  //
  // Only a REFUSED refresh ends the session. One that got no answer — no signal, a dead spot, the
  // API waking from a cold start — used to land in the same catch and log the user out, so opening
  // the app at the gate with one bar of signal threw away a working login and sent the storekeeper
  // back to the login screen to re-type their Company ID. Now the remembered session is restored,
  // the workspace opens, and the refresh is retried quietly until the network answers.
  useEffect(() => {
    setAuthFailureHandler(clearSessionState)
    let stopRetrying: (() => void) | null = null

    async function resume(): Promise<'resumed' | 'transient' | 'refused'> {
      try {
        const accessToken = await refreshSession()
        const session = sessionFromAccessToken(accessToken)
        applySession(session.user, session.client)
        return 'resumed'
      } catch (err) {
        if (isTransientRefreshFailure(err)) return 'transient'
        setAccessToken(null)
        authStorage.clearSession()
        clearSessionState()
        return 'refused'
      }
    }

    /** Retries on every sign the network may be back, plus a slow timer for "online but unreachable". */
    function retryUntilAnswered() {
      let attempting = false
      async function attempt() {
        if (attempting || document.visibilityState === 'hidden') return
        attempting = true
        const outcome = await resume()
        attempting = false
        if (outcome !== 'transient') stopRetrying?.()
      }
      const onVisible = () => {
        if (document.visibilityState === 'visible') void attempt()
      }
      window.addEventListener('online', attempt)
      document.addEventListener('visibilitychange', onVisible)
      const timer = window.setInterval(() => void attempt(), SESSION_RETRY_MS)
      stopRetrying = () => {
        window.removeEventListener('online', attempt)
        document.removeEventListener('visibilitychange', onVisible)
        window.clearInterval(timer)
        stopRetrying = null
      }
    }

    async function bootstrap() {
      if (!authStorage.getRefreshToken()) {
        setIsBootstrapping(false)
        return
      }

      // Started before anything renders, so the workspace's first requests find it in flight and
      // wait for its token (createApiClient) instead of each drawing a 401.
      const resuming = resume()

      // A phone that remembers its session opens straight onto it, from the device, while the
      // server is asked (Phase H, time to first row). Waiting for that answer first cost every
      // warm open a full round trip on a blank screen: ~150 ms on Wi-Fi, a second or more at the
      // edge of 3G. If the server then refuses the session, resume() clears it and the login
      // screen takes over, as before; nothing is shown that this phone did not already hold.
      //
      // No profile means a device that last signed in before profiles were remembered: there is
      // nothing to draw the workspace with, so that load still waits — and, if the server can't be
      // reached, shows the login screen while the retry below restores the session once it can.
      const remembered = authStorage.getSessionProfile()
      if (remembered) {
        setUser((current) => current ?? { type: 'tenant', ...remembered.user })
        setClient((current) => current ?? remembered.client)
        setIsBootstrapping(false)
      }

      const outcome = await resuming
      if (outcome === 'transient') retryUntilAnswered()
      setIsBootstrapping(false)
    }

    void bootstrap()

    return () => {
      stopRetrying?.()
      setAuthFailureHandler(null)
    }
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

  function adoptTenantSession(response: TenantLoginResponse) {
    applyTenantSession(response.tokens.accessToken, response.tokens.refreshToken, response.user)
  }

  function applyTenantSession(accessToken: string, refreshToken: string, tenantUser: TenantUser) {
    setAccessToken(accessToken)
    authStorage.setRefreshToken(refreshToken)
    applySession(
      {
        type: 'tenant',
        id: tenantUser.id,
        username: tenantUser.username,
        role: tenantUser.role,
        permissions: tenantUser.permissions,
      },
      {
        // The login response has no company id; the token does, and it is what
        // `sessionFromAccessToken` matches on to carry the company name across a reload.
        id: decodeJwtPayload<TenantAccessTokenClaims>(accessToken)?.clientId,
        identifier: tenantUser.clientIdentifier,
        name: tenantUser.clientName,
        platformOwner: tenantUser.platformOwner === true,
        clientType: tenantUser.clientType === 'VENDOR' ? 'VENDOR' : 'COMPANY',
      },
    )
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
      isPlatformOwner: client?.platformOwner === true,
      isVendor: client?.clientType === 'VENDOR',
      isSeller: client?.clientType === 'VENDOR' || client?.platformOwner === true,
      isBootstrapping,
      loginTenant,
      signup,
      adoptTenantSession,
      logout,
    }),
    [user, client, isBootstrapping],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
