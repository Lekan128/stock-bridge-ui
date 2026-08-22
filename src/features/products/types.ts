import type { VendorKind } from '@/features/vendors/types'

export interface Product {
  id: string
  name: string
  sku: string
  description: string | null
  unitPrice: number
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
   * The two marketplace identity facets. READ-ONLY on this type, and read-only on
   * `/api/products` — that endpoint has never written either of them.
   *
   * A seller sets them through the marketplace-details route instead: their own at
   * `/api/vendor/catalogue/products/:id/marketplace-details`
   * (`vendorCatalogueApi.updateMarketplaceDetails`), ProcurePal's under
   * `/api/marketplace/admin/**`. They are reported here so the product FORM can show a vendor
   * what they already have without a second fetch of the catalogue page.
   *
   * <p>`unitOfMeasure` is the commercially load-bearing one: a B2B price means nothing until
   * it means "per 50kg bag" rather than "per carton". Absent on most rows and permanently so
   * for a buying company's private stock, which has no marketplace facets at all.
   */
  brand?: string
  unitOfMeasure?: string
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
  unitPrice: number
  costPrice?: number
  lowStockThreshold?: number
  /** An entry in this company's own vendor directory. Resolved against the caller's tenant server-side. */
  companyVendorId?: string
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
