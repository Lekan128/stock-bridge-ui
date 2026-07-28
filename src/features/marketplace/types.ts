import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/constants/orderStatus'

/**
 * ProcurePal-side marketplace types: the fulfilment queue, order fulfilment detail, catalog
 * administration, categories and the commercial settings.
 *
 * ⚠️ The API sets `spring.jackson.default-property-inclusion: non_null`, so a nullable field is
 * **absent** from the JSON rather than null. Every optional field below is therefore typed as
 * `?: T | null` — `undefined` is what actually arrives, `null` is what a hand-written test fixture
 * or a future serializer change would produce, and both must be guarded the same way.
 *
 * The order shapes are duplicated here rather than imported from the buyer's `features/orders`:
 * the two features are built independently and neither should own the other's vocabulary. The
 * shared vocabulary that *is* stable — the status unions — lives in `@/constants/orderStatus` and
 * is imported by both.
 */

/** Mirrors Spring Data's `Page<T>`. Redeclared locally so this feature does not depend on `features/products`. */
export interface PageResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first: boolean
  last: boolean
}

/** Who bought it. Populated only on ProcurePal's reads — the buyer's own order view omits it. */
export interface OrderCustomer {
  clientId: string
  name: string
  slug: string
  phone?: string | null
  email?: string | null
  paymentTerms?: string | null
}

/** The delivery address as it was at checkout, snapshotted onto the order. */
export interface OrderDelivery {
  addressId?: string | null
  label?: string | null
  contactName?: string | null
  contactPhone?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  landmark?: string | null
  notes?: string | null
}

export interface OrderItem {
  id: string
  productId: string
  buyerProductId?: string | null
  productName: string
  productSku?: string | null
  unitOfMeasure?: string | null
  imageUrl?: string | null
  unitPrice: number
  quantity: number
  receivedQuantity: number
  outstandingQuantity: number
  lineTotal: number
}

export interface OrderStatusEvent {
  id: string
  /** Absent on the order's creation event. */
  fromStatus?: OrderStatus | null
  toStatus: OrderStatus
  note?: string | null
  /** Absent for system transitions (a verified payment, the abandoned-checkout sweep). */
  createdBy?: string | null
  createdAt: string
}

/** One row of the fulfilment queue. A separate, lighter shape from `AdminOrder`. */
export interface AdminOrderSummary {
  id: string
  orderNumber: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod
  currency: string
  subtotal: number
  deliveryFee: number
  total: number
  itemCount: number
  deliveryCity?: string | null
  deliveryState?: string | null
  customer?: OrderCustomer | null
  /** Absent until the order leaves PENDING_PAYMENT — fall back to `createdAt`. */
  placedAt?: string | null
  createdAt: string
}

/** One order in full, as `GET /api/marketplace/admin/orders/{id}` returns it. */
export interface AdminOrder {
  id: string
  orderNumber: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod
  currency: string
  subtotal: number
  deliveryFee: number
  total: number
  delivery?: OrderDelivery | null
  customerNote?: string | null
  cancellationReason?: string | null
  items: OrderItem[]
  events: OrderStatusEvent[]
  customer?: OrderCustomer | null
  placedByUserId?: string | null
  placedByUsername?: string | null
  itemCount: number
  distinctItemCount: number
  fullyReceived: boolean
  canCancel: boolean
  canReceive: boolean
  /**
   * The server's state machine. Every fulfilment button is driven off this list and the client
   * never re-derives it — see `nextStatusActions` in `formatters.ts` for the one documented
   * subtraction (RECEIVED, which only the buyer may set).
   */
  allowedNextStatuses: OrderStatus[]
  placedAt?: string | null
  confirmedAt?: string | null
  dispatchedAt?: string | null
  deliveredAt?: string | null
  receivedAt?: string | null
  cancelledAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminOrderQueueParams {
  status?: OrderStatus
  paymentStatus?: PaymentStatus
  clientId?: string
  q?: string
  /** ISO-8601 date-times. The UI holds plain `yyyy-mm-dd` and widens them at the API boundary. */
  from?: string
  to?: string
  page?: number
  size?: number
}

export interface AdvanceOrderStatusPayload {
  status: OrderStatus
  /** Lands on the status event the *buyer's* tracking timeline renders, so it is customer-facing. */
  note?: string
}

/** A ProcurePal product as its own merchandiser sees it — the public fields plus listing state. */
export interface AdminCatalogProduct {
  id: string
  name: string
  sku: string
  slug?: string | null
  description?: string | null
  brand?: string | null
  unitPrice: number
  costPrice?: number | null
  imageUrl?: string | null
  unitOfMeasure?: string | null
  minOrderQuantity: number
  /**
   * Three different stock numbers, for three different jobs — never collapse them.
   *  - `quantityOnHand`: the raw shelf count in the warehouse. Note this is NOT the same meaning
   *    as `quantityOnHand` on the *public* catalog DTO.
   *  - `committedQuantity`: sold on orders that are PLACED/CONFIRMED/PROCESSING and not yet
   *    dispatched. This is the number that explains a storefront "sold out" on a product whose
   *    pallets are visibly in the building.
   *  - `availableToSell`: what the storefront actually advertises (on hand − committed, floored
   *    at 0).
   *
   * `committedQuantity`/`availableToSell` are optional in the type purely defensively: they were
   * added to the API after this screen was written, and an older deployment omits them rather than
   * rendering `NaN` at the operator.
   */
  quantityOnHand: number
  committedQuantity?: number
  availableToSell?: number
  incomingQuantity: number
  lowStockThreshold?: number | null
  active: boolean
  listed: boolean
  categoryId?: string | null
  categoryName?: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminProductListParams {
  q?: string
  categoryId?: string
  listed?: boolean
  page?: number
  size?: number
}

export interface UpdateMarketplaceDetailsPayload {
  categoryId?: string
  /** `categoryId: undefined` means "leave as is"; this is the only way to uncategorise. */
  clearCategory?: boolean
  unitOfMeasure?: string
  minOrderQuantity?: number
  brand?: string
  slug?: string
}

/**
 * Partial success is the contract for bulk listing: `updated` changed, `alreadyInState` were
 * already there, `skipped` could not be touched. All three are reported to the operator.
 */
export interface BulkListingResult {
  updated: number
  alreadyInState: number
  skipped: string[]
}

/** Admin view of a category — `productCount` here counts everything, listed or not. */
export interface AdminCategory {
  id: string
  name: string
  slug: string
  parentId?: string | null
  sortOrder: number
  active: boolean
  productCount: number
}

export interface CreateCategoryPayload {
  name: string
  slug?: string
  parentId?: string
  sortOrder?: number
  active?: boolean
}

export interface UpdateCategoryPayload {
  name?: string
  slug?: string
  parentId?: string
  /** `parentId: undefined` cannot express "detach from parent"; this can. */
  clearParent?: boolean
  sortOrder?: number
  active?: boolean
}

export interface AdminMarketplaceSettings {
  deliveryFee: number
  freeDeliveryThreshold: number
  minimumOrderValue: number
  payOnDeliveryEnabled: boolean
  payOnDeliveryMaxOrderValue: number
  supportPhone?: string | null
  supportEmail?: string | null
  updatedAt?: string | null
}

/** PUT is a full replacement — every field goes back, every time (see the backend DTO's note). */
export interface UpdateMarketplaceSettingsPayload {
  deliveryFee: number
  freeDeliveryThreshold: number
  minimumOrderValue: number
  payOnDeliveryEnabled: boolean
  payOnDeliveryMaxOrderValue: number
  supportPhone?: string
  supportEmail?: string
}
