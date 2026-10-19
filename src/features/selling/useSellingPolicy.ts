import { useAuth } from '@/auth/useAuth'
import { useSellingSettings } from '@/features/selling/useSellingSettings'

export interface SellingPolicy {
  /** This account's products carry a selling price: the field, the column, the figure. */
  showsSellingPrice: boolean
  /** Every product must have one. Marketplace sellers only: a listing without a price can't be bought. */
  requiresSellingPrice: boolean
  /** This company records sales from its stock (Record a sale, the Sales report). */
  recordsSales: boolean
}

/**
 * What a selling price means for the signed-in account. It mirrors the API's `SellingPolicy` (see
 * SELLING_PRICE_PLAN.md §4.1) and must give the same answers. The server enforces them; this only
 * keeps the screens from asking for what the server would refuse, or hiding what it requires.
 *
 * `isSeller`, not `isVendor`: ProcurePal is not a vendor but does sell, and the API requires a
 * price from it. A company that sells from its stock (`sellsStock`, the company switch) shows an
 * OPTIONAL price - shown, never required.
 *
 * Until the switch has loaded, a company is treated as not selling: the screens it had before stay
 * exactly as they were, rather than flashing a price field that may then vanish.
 *
 * Moderation copy ("this goes back for review") is a different question and stays on `isVendor`.
 */
export function useSellingPolicy(): SellingPolicy {
  const { isSeller } = useAuth()
  const { data } = useSellingSettings()
  const sellsStock = data?.sellsStock === true
  return {
    showsSellingPrice: isSeller || sellsStock,
    requiresSellingPrice: isSeller,
    recordsSales: sellsStock,
  }
}
