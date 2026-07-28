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
  imageUrl: string | null
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
}

export interface ProductUpdatePayload extends Partial<ProductFormPayload> {
  active?: boolean
  removeImage?: boolean
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
