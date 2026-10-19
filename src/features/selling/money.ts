import { formatNaira, formatNairaWhole } from '@/utils/money'

/**
 * A selling figure as a shopkeeper writes it: "₦5,000", and "₦208.33" only when there IS kobo
 * (`SELLING_PRICE_PLAN.md` §6.1). Every price on the selling screens goes through this, so a price
 * reads the same in the form, the list and the sale.
 */
export function formatMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return formatNaira(value)
  const kobo = Math.round(value * 100)
  return kobo % 100 === 0 ? formatNairaWhole(kobo / 100) : formatNaira(kobo / 100)
}
