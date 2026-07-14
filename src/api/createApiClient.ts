import axios, { type AxiosError } from 'axios'
import type { AppError, AppFieldError } from '@/types/api'
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

// The backend has two error shapes in the wild: domain exceptions return a flat
// `{ message }` (ApiError), while @Valid failures fall through to Spring's default
// RFC 7807 ProblemDetail (`title`/`detail`/`errors`). Normalize both into one AppError.
function normalizeError(error: AxiosError): AppError {
  if (!error.response) {
    return { status: 0, message: 'Network error. Please check your connection and try again.' }
  }

  const status = error.response.status
  const data = error.response.data as Record<string, unknown> | undefined

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
    return { status, message: data.message }
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

  instance.interceptors.request.use((config) => {
    if (!config.public && accessToken) {
      config.headers.set('Authorization', `Bearer ${accessToken}`)
    }
    return config
  })

  let refreshPromise: Promise<string> | null = null

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
          refreshPromise ??= refreshAccessToken().finally(() => {
            refreshPromise = null
          })
          const newToken = await refreshPromise
          config.headers.set('Authorization', `Bearer ${newToken}`)
          return instance(config)
        } catch {
          handleAuthFailure()
          return Promise.reject(normalizeError(error))
        }
      }

      return Promise.reject(normalizeError(error))
    },
  )

  return { api: instance, setAccessToken, getAccessToken, setAuthFailureHandler }
}
