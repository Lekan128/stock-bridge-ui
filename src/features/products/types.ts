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
  /**
   * The low-stock trigger, **in stock units** — `UNIT_UX_CONTRACT.md` §9.4 calls this
   * `UNIT_COPY.LOW_STOCK_ALERT_AT` ("Tell me when stock falls to") wherever a human reads
   * it, and the wire keeps the old spelling because §9.4 renames headers and labels, not entity
   * fields or Java identifiers.
   *
   * <p>What DID change is the basis a human enters it in. §9.1 makes the product form count this
   * in **packs** whenever the product declares one — thirty-two bags, not 1,600 kg — while this
   * field, and the column behind it, stay in stock units exactly as before. `ProductFormPage`
   * divides on the way in and multiplies on the way out. Do not render this number raw beside a
   * pack-counted figure: they are the same quantity in two units, and the last time two such
   * numbers shared a row without saying which was which, a user entered twelve and got 12 kg.
   */
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
  /**
   * The closed list of units a quantity for this product may be entered in — `UNIT_UX_CONTRACT.md`
   * §2.3. Server-composed from §2.1 steps 1, 2 and 4 (the stock unit, the product's own pack, and
   * the same-category base units); a SUPPLIER's own pack is step 3 and appears only on
   * `ProductVendor.unitOptions`, since it is only meaningful once a supplier has been chosen.
   *
   * Optional because the API omits null fields and because a response predating this field must
   * not break the UI — `unitSet.unitOptionsForProduct` prefers this list verbatim when it is
   * present (the server is the authority; its list is what request validation runs against) and
   * derives the same set locally when it is not.
   */
  unitOptions?: UnitOption[]
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
  /**
   * The opening purchase price, **per ONE stock unit** — `UNIT_UX_CONTRACT.md` §9.2. It lands in
   * `Product.costPrice`, whose own entity doc pins the same basis. Never per pack: an ₦80,000
   * bag of 80 kg is sent as 1,000, and the form echoes the pack figure back so the divide is
   * checkable rather than remembered.
   */
  cost: number
  /**
   * The opening stock-in, **in stock units** — the ledger's own basis, unchanged.
   *
   * The FORM collects it in packs when the product declares one (§9.1's opening stock, §9.3's
   * receiving default), so what a user typed and what arrives here differ by the pack's factor.
   * `ProductFormPage.toStockUnits` is the one place that conversion happens, at §3.1's HALF_UP
   * scale 0.
   */
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
  /** In STOCK UNITS, like `Product.lowStockThreshold` — the form collects it in packs (§9.1)
   *  and converts before it reaches this payload. See `ProductFormPage.toStockUnits`. */
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
  /**
   * The unit's DECLARED role. Useful for grouping a picker; **not** the right filter for deciding
   * what may go in a stock-unit or pack field — use `canBeStockUnit`/`canBePack` for that.
   */
  role: UnitOfMeasureRole
  /** May be a product's stock unit. Served by the API so no client re-derives the rule. */
  canBeStockUnit?: boolean
  /**
   * May be a product's pack. True for every COUNT unit, including `PIECE`, whose declared role is
   * BASE — a turmeric sold in 34 g pieces is `G` + `PIECE` + 34, and filtering the pack picker on
   * `role === 'PACKAGING'` would make that undescribable.
   */
  canBePack?: boolean
  /**
   * The short form a number is written with — `"kg"` for `"Kilogram (kg)"`, `"Piece"` for
   * `"Piece"`. What every quantity on screen is suffixed with, per `UNIT_UX_CONTRACT.md` §2.1
   * step 1, and what a live "50 kg per bag" hint reads from.
   *
   * Served so no client has to keep a second table of which label abbreviates to what — that
   * duplicated table is how the four vocabularies in plan §2 grew. `unitSet.resolveUnitSymbol`
   * prefers this and falls back to parsing the label's parenthetical, so a response that predates
   * it still renders correctly. Optional because the API omits null fields.
   */
  symbol?: string
  /**
   * How many of this category's canonical unit one of these is — `UNIT_UX_CONTRACT.md` §2.2.
   * `WEIGHT: MG 0.000001 · G 0.001 · KG 1 · T 1000`, and so on per category.
   *
   * Exists so a KG product can accept a delivery expressed in tonnes: the factor from `A` to a
   * stock unit `B` is `A.factorToCanonical / B.factorToCanonical`, only ever within one
   * `UnitOfMeasureCategory` (cross-category is not a conversion and must never be offered).
   * Until this landed, `UnitOfMeasure` GROUPED kg/g/t by category while storing no factors — so
   * the picker looked like a conversion existed when none did (plan §3's P1-7).
   *
   * Absent for every PACKAGING-role constant: a Bag is not a fixed amount of anything, and its
   * factor comes from a product's `packagingSize`, never from the unit itself. Optional here
   * because the API omits null fields (Jackson NON_NULL) — compare with `== null`.
   */
  factorToCanonical?: number | null
}

/**
 * One enterable unit for a product — `UNIT_UX_CONTRACT.md` §2, the one new abstraction.
 *
 * A product's **unit set** is the closed list of these a quantity for that product may be
 * entered in. It is derived, never stored: see §2.1's algorithm, implemented on this side in
 * `features/products/unitSet.ts` and served on `ProductResponse.unitOptions` /
 * `ProductVendorResponse.unitOptions`.
 *
 * Every quantity entry point in the app draws its unit choices from a set of these and nothing
 * else. The old "full list of all ~30 units" pickers were deleted rather than repaired: a unit
 * with no conversion factor is not an alternative unit, it is an unanswerable question, and
 * offering one is what produced the reported complaint (plan §3's P1-1 and P1-3).
 */
export interface UnitOption {
  /** A `UnitOfMeasure` code — the product's stock unit code, or a packaging code like `"BAG"`.
   *  Empty string only in §2.1's single-entry set for a product with no stock unit at all. */
  code: string
  /** What a picker shows: §1's Pack phrase (`"Bag of 50 kg"`) for a pack, or the stock unit's
   *  short symbol (`"kg"`). Never a raw code — `"KG"` is our vocabulary, not the reader's. */
  label: string
  /** Multiply an entered quantity by this to reach stock units; divide an entered PRICE by it
   *  to reach a per-stock-unit price (§3.2). Always present and always > 0 — that guarantee is
   *  the whole point of the type. */
  factorToStockUnit: number
  isStockUnit: boolean
  /**
   * True when this option is a PACK (§2.1 steps 2–3), false for the stock unit and for step 4's
   * same-category base units. Mirrors the server's `UnitOption.isPack`.
   *
   * What it is for: "the ways this product is actually bought and sold" is `isStockUnit || isPack`,
   * and that is the set a quantity control should offer. Step 4's `g`/`t`/`cm` are real
   * conversions but not how anyone describes a delivery, and putting them in the same dropdown is
   * what made it read "mm · or Dozen of 12 mm · or cm · or m" — four options where two are the
   * answer. The spreadsheet already draws this line (`how_you_count_it` prints steps 1–3 only);
   * this is the same line on screen.
   */
  isPack?: boolean
  /** Exactly one `true` per set — what a form preselects. The product's own pack if it has one,
   *  else the stock unit. */
  isDefault: boolean
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
