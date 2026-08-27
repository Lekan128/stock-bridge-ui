import { z } from 'zod'
import type { InitialVendorPayload, ProductFormPayload, ProductUpdatePayload } from '@/features/products/types'
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
    // Same numeric-string shape as unitPrice, decimals allowed ("0.5 KG" is a real count) —
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
    // No `costPrice` field here: the product's cost is a weighted-average rollup the server
    // computes from actual purchases (see MULTI_VENDOR_INVENTORY_DESIGN.md §5.3), never a value
    // typed alongside the "First vendor" block's own per-unit cost for the same purchase. That
    // block's `initialVendorCost` below is the only place a cost is entered on this form.
    lowStockThreshold: z
      .string()
      .trim()
      .refine((v) => v === '' || isNonNegativeInteger(v), 'Enter a whole number, 0 or greater'),
    // ---- "First vendor" (§7.1) — create-only, optional as a whole. A plain optional id with no
    // shape rule, same reasoning the old companyVendorId field used: the select only ever offers
    // ids the server just sent back, and the server re-resolves whatever arrives against the
    // caller's own directory anyway. Empty means "no vendor yet", the normal state for a product
    // catalogued ahead of its first delivery.
    initialVendorId: z.string().trim(),
    // Required together with initialVendorId (superRefine below), never on its own. Decimals
    // allowed, same shape as unitPrice.
    initialVendorCost: z
      .string()
      .trim()
      .refine((v) => v === '' || isNonNegativeNumber(v), 'Enter a valid non-negative cost'),
    // The opening stock-in quantity for this vendor. Whole units, > 0 — a stock movement of zero
    // isn't a movement.
    initialVendorQuantity: z
      .string()
      .trim()
      .refine((v) => v === '' || isPositiveInteger(v), 'Enter a whole number greater than 0'),
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

    // Rule 3 — the "First vendor" block (§7.1) is optional as a whole, but its three fields are
    // all-or-nothing together: picking a vendor with no cost/quantity would create a
    // `ProductVendor` row with no opening stock to show for it, and entering a cost or quantity
    // with no vendor chosen has nowhere on the server to attach to.
    const hasInitialVendor = values.initialVendorId.length > 0
    const hasInitialCost = values.initialVendorCost.length > 0
    const hasInitialQuantity = values.initialVendorQuantity.length > 0
    if (hasInitialVendor && !hasInitialCost) {
      ctx.addIssue({ code: 'custom', path: ['initialVendorCost'], message: 'Required when a vendor is selected' })
    }
    if (hasInitialVendor && !hasInitialQuantity) {
      ctx.addIssue({ code: 'custom', path: ['initialVendorQuantity'], message: 'Required when a vendor is selected' })
    }
    if ((hasInitialCost || hasInitialQuantity) && !hasInitialVendor) {
      ctx.addIssue({ code: 'custom', path: ['initialVendorId'], message: 'Select a vendor to record cost or quantity' })
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
    lowStockThreshold: values.lowStockThreshold ? Number(values.lowStockThreshold) : undefined,
  }
}

/**
 * The "First vendor" block (§7.1) as the `initialVendor` the create request wants — the first
 * `ProductVendor` row and its opening stock-in, folded into product creation itself. `undefined`
 * when the (optional) block was left blank, which is the normal case for a product catalogued
 * with no vendor or stock yet; the schema's superRefine guarantees cost/quantity are present
 * whenever a vendor id is, so `Number(...)` below is never fed an empty string.
 *
 * <p>Create-only by convention, not by type: `ProductFormPage` never renders this section in
 * edit mode, so `values.initialVendorId` is always `''` there and this always returns
 * `undefined` on an update.
 */
export function toInitialVendorPayload(values: ProductFormValues): InitialVendorPayload | undefined {
  if (!values.initialVendorId) return undefined
  return {
    companyVendorId: values.initialVendorId,
    cost: Number(values.initialVendorCost),
    quantity: Number(values.initialVendorQuantity),
  }
}

/**
 * The update half of the payload. Now a thin alias over `toProductPayload` — the old reason for
 * this being a separate function (expressing "clear the supplier" with `clearCompanyVendor`,
 * since an absent `companyVendorId` meant "leave it alone") no longer applies: there is no flat
 * per-product supplier field left to clear. Kept as its own export because `ProductFormPage`
 * calls it by name and a product no longer has just one vendor to reason about here at all — see
 * the Vendors tab for how an existing product's `ProductVendor` rows are actually managed.
 */
export function toProductUpdatePayload(values: ProductFormValues): ProductUpdatePayload {
  return toProductPayload(values)
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
    lowStockThreshold: '',
    initialVendorId: '',
    initialVendorCost: '',
    initialVendorQuantity: '',
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

const quantityField = z
  .string()
  .trim()
  .min(1, 'Quantity is required')
  .refine((v) => v.length === 0 || isPositiveInteger(v), 'Enter a whole number greater than 0')

/**
 * Stock-in's form schema. `vendorRequired` is threaded in rather than baked in statically
 * because whether a vendor must be picked depends on data fetched at runtime (does this product
 * already have a `ProductVendor` row, is the company vendor directory even non-empty) — see
 * `StockInModal`'s vendor-field logic, which mirrors §7.3 of the multi-vendor inventory design:
 * the user only ever picks a vendor when it's actually ambiguous or new.
 *
 * `packagingUnit`/`packagingSize` here are the ADVANCED "what was actually delivered differs
 * from the vendor's usual packaging" snapshot pair (design §5.2), not the simple base⟷packaging
 * unit toggle — that's tracked outside react-hook-form as plain `unit` state, since it's a
 * structurally-valid-by-construction toggle/select, not free text needing validation.
 */
export function makeStockInSchema(vendorRequired: boolean) {
  return z
    .object({
      quantity: quantityField,
      unitPrice: z.string().trim().refine((v) => v === '' || isNonNegativeNumber(v), 'Enter a valid non-negative price'),
      companyVendorId: z.string().trim(),
      packagingUnit: z.string().trim(),
      packagingSize: z
        .string()
        .trim()
        .refine((v) => v === '' || isNonNegativeNumber(v), 'Enter a valid non-negative number'),
      note: noteField,
    })
    .superRefine((values, ctx) => {
      if (vendorRequired && values.companyVendorId.trim().length === 0) {
        ctx.addIssue({ code: 'custom', path: ['companyVendorId'], message: 'Choose a vendor' })
      }
      const hasPackagingUnit = values.packagingUnit.length > 0
      const hasPackagingSize = values.packagingSize.length > 0
      if (hasPackagingUnit && !hasPackagingSize) {
        ctx.addIssue({ code: 'custom', path: ['packagingSize'], message: 'Required when packaging unit is set' })
      }
      if (hasPackagingSize && !hasPackagingUnit) {
        ctx.addIssue({ code: 'custom', path: ['packagingUnit'], message: 'Required when pack size is set' })
      }
    })
}

export type StockInFormValues = z.infer<ReturnType<typeof makeStockInSchema>>

/**
 * Stock-out's form schema — deliberately just quantity and note. No vendor, no unit-validation
 * beyond "a positive whole number": per §6/§7.5 of the design, lot allocation is either left to
 * server-side FIFO (simple path) or built from real `StockMovement` rows in the advanced
 * disclosure, neither of which is a free-text field this schema needs to police. The available-
 * quantity ceiling is intentionally NOT enforced here (unlike the old `makeStockQuantitySchema`)
 * because once the unit toggle lets someone enter "3 bags", checking against a base-unit
 * `currentQuantity` needs a live unit conversion this static schema has no access to — the
 * server's 409 (with the actual available/requested numbers) is the authoritative check instead.
 */
export const stockOutSchema = z.object({
  quantity: quantityField,
  note: noteField,
})

export type StockOutFormValues = z.infer<typeof stockOutSchema>

export const stockAdjustmentSchema = z.object({
  newQuantity: z
    .string()
    .trim()
    .min(1, 'New quantity is required')
    .refine((v) => v.length === 0 || isNonNegativeInteger(v), 'Enter a whole number, 0 or greater'),
  note: z.string().trim().min(1, 'A reason is required').max(1000, 'Must be 1000 characters or fewer'),
})

export type StockAdjustmentFormValues = z.infer<typeof stockAdjustmentSchema>
