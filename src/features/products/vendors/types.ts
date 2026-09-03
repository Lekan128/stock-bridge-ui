/**
 * `ProductVendor` — one row per (product, vendor), the Odoo "vendor pricelist line" / NetSuite
 * "item vendor line" pattern. See MULTI_VENDOR_INVENTORY_DESIGN.md §5.1.
 *
 * Distinct from `CompanyVendor` (`@/features/vendors/types`), which is the buyer's own supplier
 * *directory* — one row per supplier, company-wide. A `ProductVendor` is the join between one
 * `Product` and one `CompanyVendor`: what that supplier costs, what they call it, and how much of
 * it has come from them. `companyVendorId`/`companyVendorName`/`companyVendorKind`/
 * `companyVendorActive` here are denormalised off that directory row, the same "read-only
 * snapshot alongside the id" pattern `Product.companyVendorName` used to follow before this
 * feature replaced it.
 */
import type { UnitOption } from '@/features/products/types'
import type { VendorKind } from '@/features/vendors/types'

/**
 * One quantity break on a `ProductVendor` — "₦46,000/bag under 10 bags, ₦44,000/bag at 10+".
 *
 * `minQuantity` is always in the PRODUCT's base unit of measure (never a packaging unit),
 * specifically so tiers compare consistently no matter what unit a given purchase happens to be
 * entered in — see §5.1a. It is inclusive: a tier applies AT `minQuantity` and above, the same way
 * a human reads "10+ bags".
 */
export interface ProductVendorPriceTier {
  id: string
  /** Always in the product's STOCK unit — never a pack. §5.1a. */
  minQuantity: number
  /**
   * Always **per stock unit** — `UNIT_UX_CONTRACT.md` §3.2, and the fix for plan §3's P0-2.
   *
   * It used to be neither: `AddPriceTierModal` converted `minQuantity` into stock units and sent
   * `unitPrice` straight through from a field labelled "per bag", so a stored row meant "at
   * 500 kg, ₦44,000 per bag" — an internally mixed-unit record that `cheaperVendorHint` then
   * compared against a stock-in price of a third, unknown basis. Both halves are converted now,
   * and every render of this number states what it is per.
   */
  unitPrice: number
}

export interface ProductVendor {
  id: string
  productId: string
  companyVendorId: string
  companyVendorName: string
  companyVendorKind: VendorKind
  /**
   * Whether the underlying `CompanyVendor` directory entry is still active. `false` means this
   * supplier was deactivated (soft-deleted) from the company's directory — the row still renders
   * here, fully, per §7.4: deactivating a supplier must never weaken the traceability this whole
   * feature exists to provide. It only disqualifies the vendor from *new* pickers elsewhere
   * (stock-in's vendor selector, the "create product" form) — never from this tab.
   */
  companyVendorActive: boolean
  /** That vendor's own code for this item, if known. Not this company's SKU. */
  vendorSku: string | null
  /**
   * The flat, most-recent cost from this vendor, refreshed on every stock-in from them.
   * `null` until the first delivery is recorded. Superseded for display purposes by
   * `priceTiers` when the vendor has any — see the Vendors tab's "from ₦X" treatment.
   */
  lastCostPrice: number | null
  /** Prefills the stock-in form and the price-tier form's unit for this vendor. Both nullable — a
   *  vendor with no configured packaging is priced/counted in the product's base unit directly.
   *
   *  A per-delivery pack override must NEVER write itself back here without an explicit opt-in on
   *  the same screen (`UNIT_UX_CONTRACT.md` §3.4 / §7.7, closing plan §3's P0-5). */
  defaultPackagingUnit: string | null
  defaultPackagingSize: number | null
  /**
   * NetSuite-style manual pin — at most one `true` per product. A swap, not an independent
   * boolean: setting this `true` for one vendor atomically un-sets it for whichever other vendor
   * held it, server-side. There is deliberately no client affordance to set it `false` directly —
   * see the Vendors tab's preferred toggle.
   */
  isPreferred: boolean
  /** Cached display rollup — "how much do we currently have from this vendor". Not what stock-out
   *  draws down against directly (that's lot-level allocation); recomputable if it ever drifts. */
  quantityOnHandFromVendor: number
  /** Lifetime total received from this vendor, regardless of what has since sold. */
  totalQuantityReceived: number
  /** Collapsed by default in the UI — most vendors have none. See `ProductVendorPriceTier`. */
  priceTiers: ProductVendorPriceTier[]
  /**
   * This supplier's unit set — `UNIT_UX_CONTRACT.md` §2.3. Same list as
   * `Product.unitOptions` plus §2.1 step 3, THIS supplier's own default pack. Used by the
   * stock-in form once a supplier is chosen, so "counted in" offers the pack they actually
   * deliver in rather than only the product's own.
   *
   * Optional for the same two reasons as `Product.unitOptions`: the API omits null fields, and
   * `unitSet.unitOptionsForSupplier` derives an equivalent set locally when it is absent.
   */
  unitOptions?: UnitOption[]
  createdAt: string
  updatedAt: string
}

/**
 * `PATCH /api/products/{productId}/vendors/{vendorId}` body — any subset of these fields.
 * Used for two distinct edits that happen to share one endpoint: editing packaging defaults, and
 * the preferred-vendor swap (`{ isPreferred: true }` alone triggers the atomic server-side swap).
 */
export interface ProductVendorUpdatePayload {
  vendorSku?: string
  defaultPackagingUnit?: string
  defaultPackagingSize?: number
  isPreferred?: boolean
}

/**
 * `POST .../price-tiers` body. **Both** numbers must already be converted into the product's
 * stock unit before this is sent — `minQuantity` multiplied by the entry unit's factor,
 * `unitPrice` DIVIDED by it (`UNIT_UX_CONTRACT.md` §3.1 and §3.2).
 *
 * The asymmetry is the whole reason this comment exists: converting only the quantity, which is
 * what shipped, produces a row that means "at 500 kg, ₦44,000 per bag". `AddPriceTierModal` does
 * both conversions at submit time and shows both previews while the form is being filled, so the
 * form itself can stay in whatever unit the supplier is easiest to think about.
 */
export interface PriceTierPayload {
  /** In the product's stock unit. */
  minQuantity: number
  /** Per the product's stock unit — never per pack. */
  unitPrice: number
}
