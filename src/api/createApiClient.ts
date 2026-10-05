import axios, { type AxiosError } from 'axios'
import { isAppError, type AppError, type AppFieldError } from '@/types/api'
import type { AuthTokens } from '@/types/auth'

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** Public auth endpoint: skip attaching the access token and skip 401 refresh-retry. */
    public?: boolean
    /** Internal — set once a request has already gone through one refresh-and-retry cycle. */
    _retry?: boolean
  }
}

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

function normalizeFieldErrors(errors: unknown): AppFieldError[] {
  if (!Array.isArray(errors)) return []
  return errors.map((entry): AppFieldError => {
    if (typeof entry === 'string') return { message: entry }
    if (entry && typeof entry === 'object') {
      const e = entry as Record<string, unknown>
      const field = typeof e.field === 'string' ? e.field : typeof e.property === 'string' ? e.property : undefined
      const message =
        typeof e.message === 'string'
          ? e.message
          : typeof e.defaultMessage === 'string'
            ? e.defaultMessage
            : String(entry)
      return { field, message }
    }
    return { message: String(entry) }
  })
}

/**
 * RFC 9110 allows `Retry-After` to be either a delay in seconds or an HTTP date; the API sends
 * seconds, and the date form is parsed only so a proxy that rewrites it cannot break the caller.
 *
 * Returns undefined when the header is unreadable — which includes the ordinary cross-origin
 * case, since `Retry-After` is not CORS-safelisted and the browser hides it unless the API
 * exposes it. Every caller must have a sensible answer for "we were throttled but do not know
 * for how long".
 */
function parseRetryAfterSeconds(error: AxiosError): number | undefined {
  const raw = error.response?.headers?.['retry-after']
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined

  const asNumber = Number(raw)
  if (Number.isFinite(asNumber)) return asNumber > 0 ? Math.ceil(asNumber) : undefined

  const asDate = Date.parse(String(raw))
  if (Number.isNaN(asDate)) return undefined
  const seconds = Math.ceil((asDate - Date.now()) / 1000)
  return seconds > 0 ? seconds : undefined
}

// The backend has two error shapes in the wild: domain exceptions return a flat
// `{ message }` (ApiError), while @Valid failures fall through to Spring's default
// RFC 7807 ProblemDetail (`title`/`detail`/`errors`). Normalize both into one AppError.
function normalizeError(error: AxiosError): AppError {
  const normalized = normalizeErrorBody(error)
  const retryAfterSeconds = parseRetryAfterSeconds(error)
  return retryAfterSeconds === undefined ? normalized : { ...normalized, retryAfterSeconds }
}

/**
 * No response at all. Three different situations, worded differently because the reader can do
 * something different about each: turn data back on, wait for the server, or just try again.
 * `navigator.onLine === false` is reliable when it says offline; when it says online it only means
 * "some network interface is up", which is why the default is "couldn't reach", not "offline".
 */
/** What a request that never got an answer says — and how `ErrorState` knows to stay calm (U8). */
export const NETWORK_MESSAGES = {
  offline: "You're offline. Check your connection and try again.",
  timeout: 'The server took too long to answer. Check your connection and try again.',
  unreachable: "Couldn't reach Procurepaddy. Check your connection and try again.",
} as const

export function isNetworkMessage(message: string | null | undefined): boolean {
  return message != null && (Object.values(NETWORK_MESSAGES) as string[]).includes(message)
}

function networkError(error: AxiosError): AppError {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { status: 0, kind: 'offline', message: NETWORK_MESSAGES.offline }
  }
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return {
      status: 0,
      kind: 'timeout',
      message: NETWORK_MESSAGES.timeout,
    }
  }
  return {
    status: 0,
    kind: 'unreachable',
    message: NETWORK_MESSAGES.unreachable,
  }
}

function normalizeErrorBody(error: AxiosError): AppError {
  if (!error.response) return networkError(error)

  const kind = error.response.status >= 500 ? 'server' : 'client'
  return { ...normalizeResponseBody(error.response.status, error.response.data), kind }
}

function normalizeResponseBody(status: number, responseData: unknown): AppError {
  const data = responseData as Record<string, unknown> | undefined

  // Bulk-upload validation failures respond with a raw ProductRowError[] body
  // (not wrapped in an object) so the frontend can render it directly.
  if (Array.isArray(data)) {
    const rowErrors = data
      .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
      .map((entry) => ({
        row: typeof entry.row === 'number' ? entry.row : 0,
        column: typeof entry.column === 'string' ? entry.column : '',
        message: typeof entry.message === 'string' ? entry.message : String(entry),
      }))
    return {
      status,
      message: `${rowErrors.length} row error(s) found in the uploaded file.`,
      rowErrors,
    }
  }

  if (data && typeof data.message === 'string' && !Array.isArray(data.errors) && !data.title) {
    // Stock-out's 409 oversell body carries two extra numeric fields alongside the flat
    // `{message}` shape every other domain exception uses (multi-vendor inventory design §5.2a).
    // Passed through only when both are actually numbers, so every other flat-message error
    // (which has neither field) is completely unaffected.
    const availableQuantity = typeof data.availableQuantity === 'number' ? data.availableQuantity : undefined
    const requestedQuantity = typeof data.requestedQuantity === 'number' ? data.requestedQuantity : undefined
    return { status, message: data.message, availableQuantity, requestedQuantity }
  }

  if (data && (typeof data.title === 'string' || typeof data.detail === 'string' || Array.isArray(data.errors))) {
    const fieldErrors = normalizeFieldErrors(data.errors)
    return {
      status,
      message: (data.detail as string) || (data.title as string) || 'Validation failed.',
      errors: fieldErrors.length ? fieldErrors : undefined,
    }
  }

  return { status, message: 'Something went wrong. Please try again.' }
}

export interface ApiClientOptions {
  refreshPath: string
  loginRedirectPath: string
  getRefreshToken: () => string | null
  setRefreshToken: (token: string) => void
  clearSession: () => void
}

/**
 * Builds an independent axios instance with its own in-memory access token, its own
 * single-flight 401-refresh-retry cycle, and its own auth-failure redirect. Used to give
 * the tenant and super-admin auth stacks fully separate token slots — see AuthContext.tsx
 * and SuperAdminAuthContext.tsx, neither of which should ever be able to clobber the other's
 * session.
 */
export function createApiClient({ refreshPath, loginRedirectPath, getRefreshToken, setRefreshToken, clearSession }: ApiClientOptions) {
  const instance = axios.create({ baseURL })

  // The access token lives only in memory, never in localStorage — a stolen localStorage
  // dump can't be replayed as a live session.
  let accessToken: string | null = null
  function setAccessToken(token: string | null): void {
    accessToken = token
  }
  function getAccessToken(): string | null {
    return accessToken
  }

  // Registered by the auth provider so a hard 401->refresh failure can reset React state,
  // not just storage, before the redirect below fires.
  let authFailureHandler: (() => void) | null = null
  function setAuthFailureHandler(handler: (() => void) | null): void {
    authFailureHandler = handler
  }

  let refreshPromise: Promise<string> | null = null

  instance.interceptors.request.use(async (config) => {
    if (config.public) return config
    // The workspace opens from the remembered session while its token is still being fetched
    // (AuthProvider), so a screen's first requests can start before there is one. They wait for
    // it rather than going out bare, being refused, and asking for another.
    if (!accessToken && refreshPromise) {
      await refreshPromise.catch(() => {
        // No token after all: the request goes without one, and its 401 is handled below.
      })
    }
    if (accessToken) {
      config.headers.set('Authorization', `Bearer ${accessToken}`)
    }
    return config
  })

  /**
   * Single-flight token refresh, shared by the 401 interceptor below and by the auth provider
   * (bootstrap, and resuming a session once the network is back). Sharing it is not a nicety: the
   * API rotates refresh tokens, so two refreshes racing with the same token would have the loser
   * refused — and a refused refresh logs the user out.
   */
  function refreshSession(): Promise<string> {
    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null
    })
    return refreshPromise
  }

  async function refreshAccessToken(): Promise<string> {
    const refreshToken = getRefreshToken()
    if (!refreshToken) {
      throw new Error('No refresh token available')
    }

    const { data } = await instance.post<AuthTokens>(refreshPath, { refreshToken }, { public: true })

    setAccessToken(data.accessToken)
    setRefreshToken(data.refreshToken)
    return data.accessToken
  }

  function handleAuthFailure(): void {
    setAccessToken(null)
    clearSession()
    authFailureHandler?.()
    if (window.location.pathname !== loginRedirectPath) {
      window.location.assign(loginRedirectPath)
    }
  }

  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config
      const status = error.response?.status

      if (status === 401 && config && !config.public && !config._retry) {
        config._retry = true
        try {
          const newToken = await refreshSession()
          config.headers.set('Authorization', `Bearer ${newToken}`)
          return instance(config)
        } catch (refreshError) {
          // Only a refusal ends the session. A refresh that never got an answer — the signal
          // dropped between the 401 and the refresh, or the server is waking up — says nothing
          // about whether the session is valid, and logging out over it threw away a working
          // login every time a phone walked into a dead spot with an expired access token.
          if (isTransientRefreshFailure(refreshError)) return Promise.reject(refreshError)
          handleAuthFailure()
          return Promise.reject(normalizeError(error))
        }
      }

      return Promise.reject(normalizeError(error))
    },
  )

  return { api: instance, setAccessToken, getAccessToken, setAuthFailureHandler, refreshSession }
}

/**
 * Whether a failed refresh might succeed if simply tried again later: no answer at all (offline,
 * unreachable, timed out) or a server error. Everything else — 400/401/403, or no refresh token
 * on this device — is a definite "this session is over".
 */
export function isTransientRefreshFailure(error: unknown): boolean {
  if (!isAppError(error)) return false
  return error.status === 0 || error.status >= 500
}
