import type { VendorKind } from '@/features/vendors/types'

export interface Product {
  id: string
  name: string
  sku: string
  description: string | null
  /**
   * The marketplace selling price. `null` for a buying company's private stock — unit price is
   * meaningless there, and the server now silently discards one if a company ever sent it. Only
   * a marketplace seller (`isVendor`) has this required and non-null; see `ProductFormPage` for
   * where that requirement is enforced client-side, since the server 400s with a general
   * (not field-mapped) `UnitPriceRequiredException` if a seller omits it.
   */
  unitPrice: number | null
  /** Usable stock: what can be picked, sold or consumed today. */
  quantityOnHand: number
  costPrice: number | null
  /**
   * Stock bought from ProcurePal, paid for, and NOT yet physically received — visible so nobody
   * re-orders something already on its way, and explicitly not usable until receipt is confirmed.
   *
   * ⚠️ **`GET /api/products` does not currently send this.** The column exists (migration V6 added
   * `products.incoming_quantity`) and the JPA entity maps it, but `ProductResponse` — the DTO
   * behind `/api/products`, `/api/products/{id}` and `/api/products/low-stock` — predates the
   * marketplace and has no such component. Only `AdminCatalogProductResponse` exposes it today.
   *
   * Optional, and deliberately NOT normalised to `0` at the API layer: `undefined` ("the server
   * never told us") and `0` ("the server told us there is none") are different facts, and
   * `resolveIncoming()` needs to tell them apart to decide whether to fall back to the
   * order-derived figure. See `features/orders/incomingStock.ts`.
   */
  incomingQuantity?: number
  /**
   * Links a buyer's own product row back to the ProcurePal catalog product it was created from.
   * Same caveat as above: the column exists, `ProductResponse` does not expose it yet.
   */
  sourceProductId?: string
  lowStockThreshold: number | null
  /**
   * `brand` is a marketplace identity facet, READ-ONLY on this type and on `/api/products` —
   * that endpoint has never written it. A seller sets it through the marketplace-details route
   * instead: their own at `/api/vendor/catalogue/products/:id/marketplace-details`
   * (`vendorCatalogueApi.updateMarketplaceDetails`), ProcurePal's under
   * `/api/marketplace/admin/**`. Reported here so the product FORM can show a vendor what they
   * already have without a second fetch of the catalogue page. Absent for a buying company's
   * private stock, which has no marketplace facets at all.
   */
  brand?: string
  /**
   * What this product is fundamentally measured in, as a `role: "BASE"` code from the fixed
   * list served by `GET /api/products/units-of-measure` (e.g. `"KG"`, `"LITER"`, or the generic
   * `"PIECE"` for uncounted goods). Unlike `brand`, this is WRITABLE by every tenant straight
   * through `/api/products` (create/update) — it moved off the seller-only marketplace-details
   * route, which no longer accepts it. Optional on its own; only required (by the server, and
   * mirrored client-side) when either of the packaging fields below is set.
   */
  unitOfMeasure?: string
  /**
   * How this product is packaged or sold, if at all, as a `role: "PACKAGING"` code from the
   * same fixed list (e.g. `"BAG"`, `"CARTON"`). Pairs with {@link packagingSize} to mean
   * something ("BAG" + 50 = a 50kg bag, given `unitOfMeasure: "KG"`) — both or neither, enforced
   * by the server and mirrored client-side. Blank for goods sold loose with no packaging concept.
   */
  packagingUnit?: string
  /** How many of `unitOfMeasure` are in one `packagingUnit`. Renamed from the old `unitCount`. */
  packagingSize?: number | null
  imageUrl: string | null
  /**
   * Which supplier this item comes from, as an entry in THIS company's own vendor directory
   * (`/app/vendors`). Set automatically to the ProcurePaddy seller when goods arrive from a
   * marketplace order, and settable by hand to a supplier the company added itself.
   *
   * Absent on most rows and permanently so: a product with no supplier attached is an ordinary
   * product, not an incomplete one. The name and kind are denormalised alongside the id so a
   * product list can show "from Ada Millers" without a request per row — they are read-only, and
   * the only way to change what they say is through the vendor directory itself.
   */
  companyVendorId?: string
  companyVendorName?: string
  companyVendorKind?: VendorKind
  active: boolean
  isLowStock: boolean
  createdAt: string
  updatedAt: string
  warnings?: string[] | null
}

/** Mirrors Spring Data's Page<T> JSON shape. */
export interface PageResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first: boolean
  last: boolean
}

export type ProductStatusFilter = 'all' | 'active' | 'inactive'

export interface ProductListParams {
  search?: string
  active?: boolean
  page?: number
  size?: number
  sort?: string
}

export interface ProductFormPayload {
  name: string
  sku: string
  description?: string
  /**
   * Optional at the wire level for every tenant — the server enforces "required for a
   * marketplace seller" itself (400 `UnitPriceRequiredException` if omitted) and silently
   * discards it for anyone else. Client-side, `ProductFormPage` still enforces "required for a
   * vendor" BEFORE submitting, for a faster and field-attributed error than that 400 gives.
   */
  unitPrice?: number
  /**
   * A `role: "BASE"` code from `GET /api/products/units-of-measure` (e.g. `"KG"`), or omitted.
   * Required (the server 400s with `PackagingRequiresUnitOfMeasureException`) whenever either
   * packaging field below is set; optional on its own.
   */
  unitOfMeasure?: string
  /**
   * A `role: "PACKAGING"` code from the same list (e.g. `"BAG"`), or omitted. Must be sent
   * together with {@link packagingSize} or not at all — the server 400s
   * (`PackagingUnitAndSizeRequiredTogetherException`) if only one arrives.
   */
  packagingUnit?: string
  /** Renamed from the old `unitCount`. */
  packagingSize?: number
  costPrice?: number
  lowStockThreshold?: number
  /** An entry in this company's own vendor directory. Resolved against the caller's tenant server-side. */
  companyVendorId?: string
}

export type UnitOfMeasureCategory = 'COUNT' | 'WEIGHT' | 'VOLUME' | 'LENGTH'

/**
 * `BASE` — what something is fundamentally measured in (every WEIGHT/VOLUME/LENGTH entry, plus
 * the single generic `PIECE` COUNT entry). `PACKAGING` — how something is packaged or sold (the
 * other 18 COUNT entries: Bag, Carton, Box, ...). Splits the one fetched list into the two
 * picker option-sets the product form needs — see `useUnitOfMeasureOptions`.
 */
export type UnitOfMeasureRole = 'BASE' | 'PACKAGING'

/** One entry of the fixed list at `GET /api/products/units-of-measure` — the source of truth. */
export interface UnitOfMeasureOption {
  code: string
  label: string
  category: UnitOfMeasureCategory
  role: UnitOfMeasureRole
}

/** Body for `POST /api/products/unit-of-measure-requests` — the "can't find your unit?" form. */
export interface UnitOfMeasureRequestPayload {
  requestedUnit: string
  note?: string
}

export interface ProductUpdatePayload extends Partial<ProductFormPayload> {
  active?: boolean
  removeImage?: boolean
  /**
   * Unlinks the product from its supplier. Not redundant with sending `companyVendorId: undefined`:
   * this is a patch-style payload where an absent field means "leave it alone", so without an
   * explicit flag there would be no way to express "remove the link" at all. Mirrors `removeImage`.
   */
  clearCompanyVendor?: boolean
}

export type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT'

export interface StockMovement {
  id: string
  productId: string
  movementType: MovementType
  quantity: number
  unitPriceAtTime: number | null
  note: string | null
  createdByUserId: string | null
  createdAt: string
}

export interface StockMutationResponse {
  product: Product
  movement: StockMovement | null
}

export interface StockInPayload {
  quantity: number
  unitPrice?: number
  note?: string
}

export interface StockOutPayload {
  quantity: number
  unitPrice?: number
  note?: string
}

export interface StockAdjustmentPayload {
  newQuantity: number
  note: string
}

export interface ProductRowError {
  row: number
  column: string
  message: string
}

export interface BulkUploadResponse {
  createdCount: number
  products: Product[]
}
