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
   * The name of this product's preferred vendor — whichever `ProductVendor` row (see
   * `features/products/vendors/types.ts`) currently has `isPreferred: true`, or `null` when the
   * product has no vendors at all, or has vendors but none is pinned (a valid resting state, not
   * an error — see the Vendors tab). Replaces the old single `companyVendorId`/`companyVendorName`/
   * `companyVendorKind` trio now that a product can have many vendors: a plain product row can no
   * longer point at "the" supplier, only at whichever one is preferred right now. Read-only here —
   * set it from the Vendors tab's preferred toggle, not from this type.
   */
  preferredVendorName: string | null
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

/**
 * The first `ProductVendor` row, folded into product creation per §7.1 of the multi-vendor
 * inventory design ("first vendor + cost + quantity in the same screen, not a separate step").
 * Sent only inside {@link ProductFormPayload.initialVendor} on CREATE — an existing product's
 * vendors are added/edited from the product detail page's Vendors tab, never through this form.
 *
 * <p>When present, the server atomically creates the product, this first `ProductVendor` row
 * (marked preferred), and an opening stock-in movement for `quantity` at `cost`. `vendorSku`,
 * `packagingUnit` and `packagingSize` describe how THIS vendor packages/codes the item, which
 * may differ from the product's own base unit — all three are optional and this form does not
 * collect them yet, so they are simply omitted rather than duplicated from the product's own
 * fields.
 */
export interface InitialVendorPayload {
  /** An entry in this company's own vendor directory (`/app/vendors`). */
  companyVendorId: string
  vendorSku?: string
  cost: number
  quantity: number
  packagingUnit?: string
  packagingSize?: number
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
  // No `costPrice` here: the product's cost is a server-computed weighted-average rollup from
  // actual purchases (see MULTI_VENDOR_INVENTORY_DESIGN.md §5.3), never a value this form
  // submits. It is still read-only on `Product` above, for the detail page to display.
  lowStockThreshold?: number
  /**
   * Create-only, and optional — a product may be created with zero stock and no vendor at all
   * (e.g. cataloguing ahead of a first delivery). See {@link InitialVendorPayload}. Replaces the
   * old flat `companyVendorId` field: a product no longer has ONE supplier, it has many
   * `ProductVendor` rows, and this is only how the FIRST one gets created.
   */
  initialVendor?: InitialVendorPayload
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
  // No `clearCompanyVendor` (or `companyVendorId`) here anymore — there is no flat per-product
  // supplier field left to clear. An existing product's vendors are added, edited and unlinked
  // from the product detail page's Vendors tab (`ProductVendor` rows), not through this payload.
  // `initialVendor`, inherited from `ProductFormPayload`, is create-only in practice: an update
  // has no use for it and `ProductFormPage` never populates it outside the create form.
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
  /**
   * Multi-vendor inventory extension (design spec §5.2) — set on `IN` rows only, once the
   * backend module lands. Deliberately optional/undefined-safe: today's `GET .../stock/history`
   * may not send these yet, and callers (the stock-out advanced lot picker) must degrade to
   * "vendor unknown" rather than crash when they're absent.
   */
  companyVendorId?: string
  companyVendorName?: string
  packagingUnit?: string
  packagingSize?: number | null
}

export interface CheaperVendorHint {
  companyVendorId: string
  companyVendorName: string
  unitPrice: number
  savingsPerUnit: number
}

export interface StockOutBreakdownLine {
  companyVendorId: string
  companyVendorName: string
  inMovementId: string
  inMovementCreatedAt: string
  quantity: number
}

export interface StockMutationResponse {
  product: Product
  movement: StockMovement | null
  /** True when this stock-in created the product's first `ProductVendor` row for this vendor. */
  vendorIsNewToProduct?: boolean
  /** Informational only — never auto-switched. Null/absent when no cheaper alternative exists. */
  cheaperVendorHint?: CheaperVendorHint | null
  /** Stock-out only — the FIFO (or manually-overridden) lot allocation, by vendor and delivery. */
  breakdown?: StockOutBreakdownLine[]
}

export interface StockInPayload {
  quantity: number
  /** Which of the product's configured units the quantity was entered in — omit for base unit. */
  unit?: string
  unitPrice?: number
  /** Required once the product has ≥1 `ProductVendor` row. */
  companyVendorId?: string
  /** Nullable snapshot of what was actually delivered — may differ from the vendor's default. */
  packagingUnit?: string
  packagingSize?: number
  note?: string
}

export interface StockOutPayload {
  quantity: number
  unit?: string
  /** Omitted (simple path) = server computes FIFO. Present = manual per-lot override. */
  allocations?: { inMovementId: string; quantity: number }[]
  note?: string
}

// `ProductVendor` / `ProductVendorPriceTier` (GET /api/products/{productId}/vendors) live in
// `features/products/vendors/types.ts`, not here — that's the sibling Vendors-tab module's file,
// already the richer/canonical version (adds `productId`, `createdAt`/`updatedAt`). Import from
// there rather than redeclaring a second, drifting copy here.

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
