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

/**
 * An amount as people type it: "5000", "5,000", "₦5,000", " 5 000 ". Null when it is not a
 * non-negative number - never NaN, which would quietly turn a priced line into an unpriced one.
 */
export function parseMoneyInput(text: string | null | undefined): number | null {
  if (text == null) return null
  const cleaned = text.replace(/[₦,\s]/g, '').replace(/^N(?=\d)/i, '')
  if (cleaned === '') return null
  const value = Number(cleaned)
  return Number.isFinite(value) && value >= 0 ? value : null
}
