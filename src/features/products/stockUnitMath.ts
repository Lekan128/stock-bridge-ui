/**
 * Shared conversion math for the stock-in/stock-out unit toggle (design spec §6's Zoho Unit
 * Group model — a base unit plus a short list of configured target units with a stored
 * conversion rate). Split out of `StockInModal`/`StockOutModal` because both need the exact same
 * "3 bags resolves to 150 kg" arithmetic and it must not drift between the two.
 */

/**
 * Converts an entered quantity to the product's base unit of measure.
 *
 * `unit` is the wire-contract value: `''` means "already in the base unit", anything else is a
 * unit code (usually the product's own `packagingUnit`, but the advanced disclosure allows any
 * code from the full unit-of-measure list — see the note on `packagingSizeForUnit`). Returns the
 * quantity unchanged whenever there's no known conversion rate for the given code, so an unknown
 * or not-yet-configured unit never silently multiplies by `undefined`/`NaN`.
 */
export function toBaseQuantity(quantity: number, unit: string, packagingUnitCode: string | undefined, packagingSize: number | null | undefined): number {
  if (unit && unit === packagingUnitCode && packagingSize != null && !Number.isNaN(packagingSize)) {
    return quantity * packagingSize
  }
  return quantity
}

/**
 * `formatCount(3, 'bag')` → `'3 bags'`, `formatCount(1, 'bag')` → `'1 bag'`. A plain
 * pluralisation, not `formatQuantity` from `utils/units.ts` — that helper's `qty × label` shape
 * reads fine on a receipt line but not inline in a sentence like §7.3's confirmation copy
 * ("Adding 20 bags (1,000 kg) of Rice 50kg..."), which is what this exists for.
 */
export function formatCount(quantity: number, unitLabel: string): string {
  if (!unitLabel) return String(quantity)
  const plural = unitLabel.endsWith('s') ? unitLabel : `${unitLabel}${quantity === 1 ? '' : 's'}`
  return `${quantity} ${plural}`
}
