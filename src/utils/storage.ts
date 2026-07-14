const REFRESH_TOKEN_KEY = 'sb.refreshToken'
const LAST_CLIENT_IDENTIFIER_KEY = 'sb.lastClientIdentifier'
const SUPERADMIN_REFRESH_TOKEN_KEY = 'sb.superadmin.refreshToken'

// The access token is intentionally never persisted here — it lives only in memory
// (see AuthContext) so a stolen localStorage dump can't be replayed as a live session.
//
// Tenant and super-admin sessions use entirely separate keys so the two can coexist in the
// same browser without either login clobbering the other — see superAdminAuthStorage below.
export const authStorage = {
  getRefreshToken: (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string): void => localStorage.setItem(REFRESH_TOKEN_KEY, token),

  // Persisted independently of login success so the login form can pre-fill it
  // even before the user has ever authenticated successfully.
  getLastClientIdentifier: (): string | null => localStorage.getItem(LAST_CLIENT_IDENTIFIER_KEY),
  setLastClientIdentifier: (identifier: string): void =>
    localStorage.setItem(LAST_CLIENT_IDENTIFIER_KEY, identifier),

  clearSession: (): void => {
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  },
}

export const superAdminAuthStorage = {
  getRefreshToken: (): string | null => localStorage.getItem(SUPERADMIN_REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string): void => localStorage.setItem(SUPERADMIN_REFRESH_TOKEN_KEY, token),

  clearSession: (): void => {
    localStorage.removeItem(SUPERADMIN_REFRESH_TOKEN_KEY)
  },
}
