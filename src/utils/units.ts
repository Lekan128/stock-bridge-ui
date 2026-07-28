/**
 * Quantities in a wholesale catalog are meaningless without their unit — "12" could be
 * 12 sachets or 12 pallets. The UX bar requires every quantity to be rendered with its
 * unit of measure, so both helpers live here rather than being re-derived per component.
 */

/** `12, 'bag (25kg)'` → `12 × bag (25kg)`. Falls back to unit/units when the UoM is unset. */
export function formatQuantity(quantity: number, unitOfMeasure?: string | null): string {
  if (!unitOfMeasure) return `${quantity} ${quantity === 1 ? 'unit' : 'units'}`
  return `${quantity} × ${unitOfMeasure}`
}

/** `'bag (25kg)'` → `per bag (25kg)`. Used next to a unit price. */
export function formatPerUnit(unitOfMeasure?: string | null): string {
  return `per ${unitOfMeasure || 'unit'}`
}
