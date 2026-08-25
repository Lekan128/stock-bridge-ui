import { z } from 'zod'
import type { ProductFormPayload, ProductUpdatePayload } from '@/features/products/types'
import type { VendorMarketplaceDetailsPayload } from '@/features/vendor/types'

const packagingSizeRequiredMessage = 'Required when Packaged as is set'
const packagingUnitRequiredMessage = 'Required when Pack size is set'
/**
 * Mirrors the server's `PackagingRequiresUnitOfMeasureException`, in plainer end-user language:
 * a "Bag of 50" with no measurement unit is not a real fact — 50 what? Attached to `unitOfMeasure`
 * (the field that's missing), same pattern as the pairing rule below.
 */
const unitOfMeasureRequiredForPackagingMessage = 'Required when Packaged as or Pack size is set'

function isNonNegativeNumber(value: string): boolean {
  return value.length > 0 && !Number.isNaN(Number(value)) && Number(value) >= 0
}

function isNonNegativeInteger(value: string): boolean {
  return isNonNegativeNumber(value) && Number.isInteger(Number(value))
}

function isPositiveInteger(value: string): boolean {
  return isNonNegativeInteger(value) && Number(value) > 0
}

export const productFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required'),
    sku: z.string().trim().min(1, 'SKU is required'),
    description: z.string().trim(),
    // Brand does NOT go to /api/products — that endpoint has never carried it. It rides on this
    // form because it belongs on the same screen to the person filling it in, and is sent
    // separately to the seller's marketplace-details route (vendors only). Kept optional and
    // unconstrained beyond a length: a listing sells perfectly well without a brand.
    brand: z.string().trim().max(120, 'Must be 120 characters or fewer'),
    // Unit of measure (what it's fundamentally measured in — Kg, Liter, Piece), unlike brand,
    // DOES go to /api/products now — for every tenant, not just a vendor. No content rule beyond
    // "trimmed string" here even though the server only accepts one of the fixed BASE-role codes:
    // validating a dynamic, server-fetched list inside a static zod schema would either duplicate
    // that list here (the thing `useUnitOfMeasureOptions` exists to avoid) or go stale the moment
    // the backend adds a unit. Instead correctness is structural — the <select> rendering this
    // field (see ProductFormPage) is populated only with BASE-role codes the server just
    // returned, so a value this schema doesn't recognise cannot reach it from the UI. Blank is
    // fine on its own; see the superRefine below for both cross-field rules.
    unitOfMeasure: z.string().trim(),
    // How it's packaged/sold, if at all (Bag, Carton, ...) — same structural-validity-via-select
    // approach, filtered to PACKAGING-role codes. Optional on its own; required together with
    // packagingSize (superRefine below).
    packagingUnit: z.string().trim(),
    // Same numeric-string shape as costPrice, decimals allowed ("0.5 KG" is a real count) —
    // required together with packagingUnit, never required on its own. Renamed from unitCount.
    packagingSize: z
      .string()
      .trim()
      .refine((v) => v === '' || isNonNegativeNumber(v), 'Enter a valid non-negative number'),
    // No unconditional `.min(1, ...)` here anymore: a buying company never sees this field at
    // all, and a marketplace seller leaving it blank is caught in ProductFormPage's onSubmit
    // (which knows `isVendor`; this schema does not) with the same message the server's
    // UnitPriceRequiredException uses. Still validated as a non-negative number WHEN non-empty.
    unitPrice: z
      .string()
      .trim()
      .refine((v) => v === '' || isNonNegativeNumber(v), 'Enter a valid non-negative price'),
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
  // Mirrors the server's two packaging rules. Caught here, before the request, with each error
  // attached to whichever field is missing — the server's flat `{message}` bodies wouldn't know
  // which field to point at, and a general form error for a two- or three-field mistake makes
  // someone hunt for it.
  .superRefine((values, ctx) => {
    const hasUnit = values.unitOfMeasure.length > 0
    const hasPackagingUnit = values.packagingUnit.length > 0
    const hasPackagingSize = values.packagingSize.length > 0

    // Rule 1 — mirrors PackagingUnitAndSizeRequiredTogetherException: packagingUnit and
    // packagingSize must arrive together or not at all.
    if (hasPackagingUnit && !hasPackagingSize) {
      ctx.addIssue({ code: 'custom', path: ['packagingSize'], message: packagingSizeRequiredMessage })
    }
    if (hasPackagingSize && !hasPackagingUnit) {
      ctx.addIssue({ code: 'custom', path: ['packagingUnit'], message: packagingUnitRequiredMessage })
    }

    // Rule 2 — mirrors PackagingRequiresUnitOfMeasureException: if either packaging field is
    // set, unitOfMeasure must also be set. One-directional — unitOfMeasure alone, no packaging,
    // stays valid.
    if ((hasPackagingUnit || hasPackagingSize) && !hasUnit) {
      ctx.addIssue({ code: 'custom', path: ['unitOfMeasure'], message: unitOfMeasureRequiredForPackagingMessage })
    }
  })

export type ProductFormValues = z.infer<typeof productFormSchema>

/**
 * The /api/products half of the form. Brand is deliberately absent: that endpoint does not
 * accept it, and sending it would be silently dropped — see {@link toVendorMarketplaceDetailsPayload}
 * for where it actually goes. Unit of measure and the packaging pair, unlike brand, DO belong
 * here now for every tenant.
 *
 * <p>`unitPrice` is sent only when the caller typed one — omitted, not `0`, when blank. The
 * server enforces "required for a seller" itself; a buying company's blank value is correctly
 * silently discarded there.
 */
export function toProductPayload(values: ProductFormValues): ProductFormPayload {
  return {
    name: values.name,
    sku: values.sku,
    description: values.description || undefined,
    unitPrice: values.unitPrice ? Number(values.unitPrice) : undefined,
    unitOfMeasure: values.unitOfMeasure || undefined,
    packagingUnit: values.packagingUnit || undefined,
    packagingSize: values.packagingSize ? Number(values.packagingSize) : undefined,
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
 * The other half, for the seller's own marketplace-details route — brand only now. Unit of
 * measure used to travel here too; it moved to {@link toProductPayload}, and this route's
 * payload type no longer has a component for it.
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
  }
}

export function productFormDefaults(): ProductFormValues {
  return {
    name: '',
    sku: '',
    description: '',
    brand: '',
    unitOfMeasure: '',
    packagingUnit: '',
    packagingSize: '',
    unitPrice: '',
    costPrice: '',
    lowStockThreshold: '',
    companyVendorId: '',
  }
}

export const requestUnitOfMeasureSchema = z.object({
  requestedUnit: z
    .string()
    .trim()
    .min(1, 'Tell us what unit you need')
    .max(200, 'Must be 200 characters or fewer'),
  note: z.string().trim().max(1000, 'Must be 1000 characters or fewer'),
})

export type RequestUnitOfMeasureFormValues = z.infer<typeof requestUnitOfMeasureSchema>

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
