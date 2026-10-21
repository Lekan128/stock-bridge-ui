import { superAdminApi } from '@/api/superAdminClient'

/** `GET /api/superadmin/selling/health` - `SELLING_PRICE_PLAN.md` §9. Shares are 0-1; absent when there was nothing to divide by. */
export interface SellingHealth {
  from: string
  to: string
  rollout: 'pilot' | 'open'
  companiesSelling: number
  /** How the companies selling now last turned it on: FIRST_WEEK, IN_CONTEXT, OWNER, SUPPORT. */
  turnedOnVia: Record<string, number>
  saleCount: number
  lineCount: number
  pricedShare?: number
  knownCostShare?: number
  pricesAddedPer100?: number
  cancelledPer100?: number
  priceEditShare?: number
  productsToCheck: { clientId: string; clientName: string; productId: string; productName: string; lines: number; editShare: number }[]
  companies: {
    clientId: string
    clientName: string
    saleCount: number
    lineCount: number
    pricedShare?: number
    knownCostShare?: number
    priceEditShare?: number
    lastSaleAt?: string
  }[]
}

export const sellingHealthApi = {
  get: (days: number) => {
    const to = new Date()
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
    return superAdminApi
      .get<SellingHealth>('/api/superadmin/selling/health', { params: { from: from.toISOString(), to: to.toISOString() } })
      .then((r) => r.data)
  },
}
