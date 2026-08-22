import { z } from 'zod'
import type { ProductFormPayload, ProductUpdatePayload } from '@/features/products/types'
import type { VendorMarketplaceDetailsPayload } from '@/features/vendor/types'

function isNonNegativeNumber(value: string): boolean {
  return value.length > 0 && !Number.isNaN(Number(value)) && Number(value) >= 0
}

function isNonNegativeInteger(value: string): boolean {
  return isNonNegativeNumber(value) && Number.isInteger(Number(value))
}

function isPositiveInteger(value: string): boolean {
  return isNonNegativeInteger(value) && Number(value) > 0
}

export const productFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  sku: z.string().trim().min(1, 'SKU is required'),
  description: z.string().trim(),
  // Brand and unit of measure do NOT go to /api/products — that endpoint has never carried
  // them. They ride on this form because they belong on the same screen to the person filling
  // it in, and are sent separately to the seller's marketplace-details route. Kept optional
  // and unconstrained beyond a length: a listing sells perfectly well without a brand, and the
  // unit is free text on purpose ("50kg bag", "carton of 24", "litre") because a fixed
  // enumeration of Nigerian trade units would be wrong within a month.
  brand: z.string().trim().max(120, 'Must be 120 characters or fewer'),
  unitOfMeasure: z.string().trim().max(50, 'Must be 50 characters or fewer'),
  unitPrice: z
    .string()
    .trim()
    .min(1, 'Unit price is required')
    .refine((v) => v.length === 0 || isNonNegativeNumber(v), 'Enter a valid non-negative price'),
  costPrice: z
    .string()
    .trim()
    .refine((v) => v === '' || isNonNegativeNumber(v), 'Enter a valid non-negative price'),
  lowStockThreshold: z
    .string()
    .trim()
    .refine((v) => v === '' || isNonNegativeInteger(v), 'Enter a whole number, 0 or greater'),
  // The supplier this item comes from, as an id from this company's own vendor directory. A plain
  // optional string with no shape rule: the select only ever offers ids the server just sent back,
  // and the server re-resolves whatever arrives against the caller's own directory anyway — a
  // client-side UUID regex here would add a second, weaker copy of a check that already exists
  // where it counts. Empty string means "no supplier", which is the normal state of most products.
  companyVendorId: z.string().trim(),
})

export type ProductFormValues = z.infer<typeof productFormSchema>

/**
 * The /api/products half of the form. Brand and unit of measure are deliberately absent:
 * that endpoint does not accept them, and sending them would be silently dropped. See
 * {@link toVendorMarketplaceDetailsPayload} for where they actually go.
 */
export function toProductPayload(values: ProductFormValues): ProductFormPayload {
  return {
    name: values.name,
    sku: values.sku,
    description: values.description || undefined,
    unitPrice: Number(values.unitPrice),
    costPrice: values.costPrice ? Number(values.costPrice) : undefined,
    lowStockThreshold: values.lowStockThreshold ? Number(values.lowStockThreshold) : undefined,
    companyVendorId: values.companyVendorId || undefined,
  }
}

/**
 * The update half of the payload. Separate from `toProductPayload` because clearing the supplier
 * cannot be expressed by omission — an absent `companyVendorId` means "leave it alone" server-side,
 * so "no supplier" has to be said out loud with `clearCompanyVendor`.
 */
export function toProductUpdatePayload(values: ProductFormValues): ProductUpdatePayload {
  const payload = toProductPayload(values)
  return values.companyVendorId
    ? payload
    : { ...payload, companyVendorId: undefined, clearCompanyVendor: true }
}

/**
 * The other half, for the seller's own marketplace-details route.
 *
 * <p>Empty string is sent as `''`, not omitted, and the difference matters: an omitted field
 * means "leave as is" server-side, so a vendor clearing a brand they typed by mistake would
 * find it still there. The server normalises blank to null (`blankToNull`), which is the
 * clear. Omitting it would make the field one-way.
 *
 * <p>No `slug` — a vendor may not author one, and the payload type has no such component.
 */
export function toVendorMarketplaceDetailsPayload(
  values: ProductFormValues,
): VendorMarketplaceDetailsPayload {
  return {
    brand: values.brand,
    unitOfMeasure: values.unitOfMeasure,
  }
}

export function productFormDefaults(): ProductFormValues {
  return {
    name: '',
    sku: '',
    description: '',
    brand: '',
    unitOfMeasure: '',
    unitPrice: '',
    costPrice: '',
    lowStockThreshold: '',
    companyVendorId: '',
  }
}

const noteField = z.string().trim().max(1000, 'Must be 1000 characters or fewer')

export function makeStockQuantitySchema(maxQuantity?: number) {
  return z.object({
    quantity: z
      .string()
      .trim()
      .min(1, 'Quantity is required')
      .refine((v) => v.length === 0 || isPositiveInteger(v), 'Enter a whole number greater than 0')
      .refine(
        (v) => maxQuantity === undefined || v.length === 0 || !isPositiveInteger(v) || Number(v) <= maxQuantity,
        `Cannot exceed the current quantity on hand (${maxQuantity})`,
      ),
    unitPrice: z.string().trim().refine((v) => v === '' || isNonNegativeNumber(v), 'Enter a valid non-negative price'),
    note: noteField,
  })
}

export type StockQuantityFormValues = z.infer<ReturnType<typeof makeStockQuantitySchema>>

export const stockAdjustmentSchema = z.object({
  newQuantity: z
    .string()
    .trim()
    .min(1, 'New quantity is required')
    .refine((v) => v.length === 0 || isNonNegativeInteger(v), 'Enter a whole number, 0 or greater'),
  note: z.string().trim().min(1, 'A reason is required').max(1000, 'Must be 1000 characters or fewer'),
})

export type StockAdjustmentFormValues = z.infer<typeof stockAdjustmentSchema>
