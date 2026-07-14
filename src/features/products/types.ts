export interface Product {
  id: string
  name: string
  sku: string
  description: string | null
  unitPrice: number
  costPrice: number | null
  quantityOnHand: number
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
