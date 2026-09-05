import { z } from 'zod'

/** Same string-typed-number-with-refine house style as `features/products/schemas.ts` — numbers
 *  stay strings in form state, and are coerced with `Number(...)` only when the payload is built. */
function isPositiveNumber(value: string): boolean {
  return value.length > 0 && !Number.isNaN(Number(value)) && Number(value) > 0
}

export const priceTierFormSchema = z.object({
  // Entered in whatever unit `AddPriceTierModal` is showing (the vendor's configured packaging
  // unit, or the product's base unit when the vendor has none configured) — never assumed to
  // already be in base units. Converted to base units at submit time, not here: this schema only
  // knows "a positive number was typed", not which unit it was typed in.
  minQuantity: z.string().trim().min(1, 'Required').refine(isPositiveNumber, 'Enter a number greater than 0'),
  unitPrice: z.string().trim().min(1, 'Required').refine(isPositiveNumber, 'Enter a number greater than 0'),
})

export type PriceTierFormValues = z.infer<typeof priceTierFormSchema>

/**
 * "+ Add pack" (MULTI_PACK_PER_VENDOR_DESIGN.md sections 4–7). Every field is format-only here —
 * the real cross-field rule ("a size only if a container was chosen") depends on which the user
 * picked, which this schema cannot see, so `AddPackModal` checks it itself before submit, the
 * same split `AddPriceTierRequest`'s own doc comment describes for its cross-field rules.
 */
export const addPackFormSchema = z.object({
  packagingUnit: z.string(),
  packagingSize: z.string(),
  vendorSku: z.string(),
  lastCostPrice: z.string(),
})

export type AddPackFormValues = z.infer<typeof addPackFormSchema>
