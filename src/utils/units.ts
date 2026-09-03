/**
 * Quantities in a wholesale catalog are meaningless without their unit — "12" could be
 * 12 sachets or 12 pallets. The UX bar requires every quantity to be rendered with its
 * unit of measure, so both helpers live here rather than being re-derived per component.
 *
 * <h2>Scope, and where the inventory side went</h2>
 * These two are the **buyer-facing marketplace** formatters: storefront cards, the cart, checkout,
 * order lines. They take a product's `unitOfMeasure` string as it comes back on those endpoints
 * and render it verbatim, in a `qty × label` shape that reads correctly on a line item
 * ("12 × Bag (25kg)") where the unit is a thing you are buying a count of.
 *
 * The **inventory** side — the product form, both stock modals, the vendors tab, the import
 * review grid — does not use them, and must not. Those surfaces deal in three distinct concepts
 * (stock unit, pack, entry unit) that have to be named identically everywhere and converted
 * between; `UNIT_UX_CONTRACT.md` §1 locks their vocabulary and
 * `features/products/unitCopy.ts` is the one module allowed to render it. Its `formatQuantity`
 * produces "1,000 kg" and "20 bags", not "1,000 × kg", because those strings sit inside sentences
 * and beside totals rather than on a receipt line.
 *
 * Two formatters for two audiences is the deliberate outcome, not drift — but if you are adding a
 * third, it belongs in `unitCopy.ts`. The reason `UNIT_UX_REMEDIATION_PLAN.md` §2 could count four
 * vocabularies for three concepts is that this file was the only shared one and it was never the
 * right shape for the inventory surfaces, so each of them quietly wrote its own.
 */
import { formatNumber } from '@/features/products/unitCopy'

/** `12, 'bag (25kg)'` → `12 × bag (25kg)`. Falls back to unit/units when the UoM is unset.
 *  Grouped through the shared number formatter, so a 12,000-unit line does not render as
 *  "12000 × kg" — the one thing about this helper that was worth changing. */
export function formatQuantity(quantity: number, unitOfMeasure?: string | null): string {
  if (!unitOfMeasure) return `${formatNumber(quantity)} ${quantity === 1 ? 'unit' : 'units'}`
  return `${formatNumber(quantity)} × ${unitOfMeasure}`
}

/** `'bag (25kg)'` → `per bag (25kg)`. Used next to a unit price. */
export function formatPerUnit(unitOfMeasure?: string | null): string {
  return `per ${unitOfMeasure || 'unit'}`
}
