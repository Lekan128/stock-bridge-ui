import { useAuth } from '@/auth/useAuth'

export interface SellingPolicy {
  /** This account's products carry a selling price: the field, the column, the figure. */
  showsSellingPrice: boolean
  /** Every product must have one. Marketplace sellers only: a listing without a price can't be bought. */
  requiresSellingPrice: boolean
  /** This account records counter sales from its stock (Record a sale). Nobody yet. */
  recordsSales: boolean
}

/**
 * What a selling price means for the signed-in account. It mirrors the API's `SellingPolicy` (see
 * SELLING_PRICE_PLAN.md §4.1) and must give the same answers. The server enforces them; this only
 * keeps the screens from asking for what the server would refuse, or hiding what it requires.
 *
 * `isSeller`, not `isVendor`: ProcurePal is not a vendor but does sell, and the API requires a
 * price from it. Gating the price on `isVendor` left ProcurePal's product form with no price field
 * and a save the server refused with UNIT_PRICE_REQUIRED.
 *
 * Moderation copy ("this goes back for review") is a different question and stays on `isVendor`.
 */
export function useSellingPolicy(): SellingPolicy {
  const { isSeller } = useAuth()
  return {
    showsSellingPrice: isSeller,
    requiresSellingPrice: isSeller,
    recordsSales: false,
  }
}
