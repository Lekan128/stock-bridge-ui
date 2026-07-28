const KEY = 'procurepal.pendingPayment.v1'

export interface PendingPayment {
  paymentReference: string
  orderId: string
  orderNumber?: string
  startedAt: string
}

/**
 * The payment reference we handed to Monnify, remembered across the redirect out to their hosted
 * checkout and back.
 *
 * Why this exists at all: the return page must verify server-side by `paymentReference`, and the
 * only other source for it is the query string Monnify appends — which is attacker-controllable
 * and, worse, not guaranteed to be there on every failure path. Holding our own copy means a
 * return with no usable query params still resolves to the right payment instead of a dead end.
 *
 * `sessionStorage`, not `localStorage`: it is scoped to this tab and this visit, which is exactly
 * the lifetime of one checkout. A stale reference surviving into next week would be worse than
 * having none. Nothing here is trusted for the *outcome* — that always comes from the verify call.
 */
export const paymentHandoff = {
  write: (pending: Omit<PendingPayment, 'startedAt'>): void => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ ...pending, startedAt: new Date().toISOString() }))
    } catch {
      // Private browsing / quota. The query string is still a fallback, so this is not fatal.
    }
  },

  read: (): PendingPayment | null => {
    try {
      const raw = sessionStorage.getItem(KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<PendingPayment>
      if (typeof parsed?.paymentReference !== 'string' || typeof parsed?.orderId !== 'string') return null
      return {
        paymentReference: parsed.paymentReference,
        orderId: parsed.orderId,
        orderNumber: typeof parsed.orderNumber === 'string' ? parsed.orderNumber : undefined,
        startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : new Date().toISOString(),
      }
    } catch {
      return null
    }
  },

  clear: (): void => {
    try {
      sessionStorage.removeItem(KEY)
    } catch {
      // Ignore — see write().
    }
  },
}
