const REFRESH_TOKEN_KEY = 'sb.refreshToken'
const LAST_CLIENT_IDENTIFIER_KEY = 'sb.lastClientIdentifier'
const SUPERADMIN_REFRESH_TOKEN_KEY = 'sb.superadmin.refreshToken'
// Versioned in the key itself so a future shape change can be ignored rather than migrated —
// a stale anonymous cart is worth nothing and reading a mismatched shape would throw.
const CART_KEY = 'procurepal.cart.v1'

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

/**
 * When the email-verification banner may come back, per user id.
 *
 * Dismissal persists across reloads but *expires*, and both halves are deliberate. It must
 * persist, because a banner that reappears on every navigation is noise the user learns to look
 * past — the opposite of what a one-off "your receipts are not being delivered" message needs.
 * It must expire, because the consequence does not: an unverified account keeps missing every
 * order receipt and payment confirmation for as long as it stays unverified, so permanent
 * dismissal would let someone silently opt out of ever being told again.
 *
 * A day is the interval because that is roughly the cadence at which the reminder is new
 * information — long enough that the user has had time to go and find the email, short enough
 * that they have not yet placed a week of orders they will never get receipts for. Verifying
 * removes the banner outright, so nobody who acts ever sees it a second time.
 */
const VERIFY_BANNER_DISMISSED_KEY = 'procurepal.emailVerifyBannerDismissed.v1'
const VERIFY_BANNER_DISMISS_MS = 24 * 60 * 60 * 1000

interface StoredBannerDismissal {
  userId: string
  until: number
}

export const emailVerificationStorage = {
  /** Keyed by user id so a shared browser never hides one person's banner for another's. */
  isBannerDismissed: (userId: string): boolean => {
    try {
      const raw = localStorage.getItem(VERIFY_BANNER_DISMISSED_KEY)
      if (!raw) return false
      const parsed = JSON.parse(raw) as StoredBannerDismissal | null
      if (!parsed || parsed.userId !== userId || typeof parsed.until !== 'number') return false
      return parsed.until > Date.now()
    } catch {
      return false
    }
  },

  dismissBanner: (userId: string): void => {
    try {
      const payload: StoredBannerDismissal = { userId, until: Date.now() + VERIFY_BANNER_DISMISS_MS }
      localStorage.setItem(VERIFY_BANNER_DISMISSED_KEY, JSON.stringify(payload))
    } catch {
      // Private browsing / quota. The banner then simply reappears next load, which is the
      // safe direction to fail in.
    }
  },
}

/** A line in the anonymous cart. Only ids and quantities — never prices, which go stale. */
export interface StoredCartLine {
  productId: string
  quantity: number
}

export interface StoredCart {
  items: StoredCartLine[]
  updatedAt: string
}

/**
 * The anonymous visitor's cart (contract §8). Authenticated companies use the server cart
 * instead — it is shared across the whole company and across devices, which localStorage
 * cannot be. On login the local cart is merged server-side and then cleared.
 *
 * Only CartContext may touch this; no component reads localStorage directly.
 */
export const cartStorage = {
  read: (): StoredCart | null => {
    try {
      const raw = localStorage.getItem(CART_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as unknown
      if (!parsed || typeof parsed !== 'object') return null
      const items = (parsed as StoredCart).items
      if (!Array.isArray(items)) return null
      // Filter defensively: a hand-edited or half-written entry must not poison the cart.
      const clean = items.filter(
        (line): line is StoredCartLine =>
          !!line &&
          typeof line === 'object' &&
          typeof (line as StoredCartLine).productId === 'string' &&
          Number.isFinite((line as StoredCartLine).quantity) &&
          (line as StoredCartLine).quantity > 0,
      )
      return { items: clean, updatedAt: (parsed as StoredCart).updatedAt ?? new Date().toISOString() }
    } catch {
      return null
    }
  },

  write: (items: StoredCartLine[]): void => {
    try {
      const payload: StoredCart = { items, updatedAt: new Date().toISOString() }
      localStorage.setItem(CART_KEY, JSON.stringify(payload))
    } catch {
      // Private-browsing/quota failures must never break adding to cart — the in-memory
      // cart still works for the rest of the session.
    }
  },

  clear: (): void => {
    try {
      localStorage.removeItem(CART_KEY)
    } catch {
      // Ignore — see write().
    }
  },
}
