/** Where an authenticated user lands when there is nothing more specific to return to. */
export const DEFAULT_AUTHENTICATED_PATH = '/app'

const REDIRECT_PARAM = 'redirect'

/**
 * Validates a `?redirect=` value before we navigate to it.
 *
 * The parameter is attacker-controllable (it arrives in a URL someone can send you), so an
 * unchecked value turns our own login page into an open redirect. Only same-origin, root-relative
 * paths are accepted: it must start with a single `/`, and `//evil.com` — which browsers treat as
 * protocol-relative and therefore off-site — is rejected. `/login` and `/signup` are rejected too,
 * to avoid bouncing a freshly logged-in user straight back to the login screen.
 */
export function sanitizeRedirect(raw: string | null | undefined): string | null {
  if (!raw) return null
  if (!raw.startsWith('/') || raw.startsWith('//')) return null
  const path = raw.split('?')[0]
  if (path === '/login' || path === '/signup') return null
  return raw
}

/** Reads and validates the redirect target out of a location's query string. */
export function readRedirectParam(search: string): string | null {
  return sanitizeRedirect(new URLSearchParams(search).get(REDIRECT_PARAM))
}

/** Builds the login URL that returns the user to `target` once they authenticate. */
export function buildLoginPath(target: string): string {
  const safe = sanitizeRedirect(target)
  return safe ? `/login?${REDIRECT_PARAM}=${encodeURIComponent(safe)}` : '/login'
}
