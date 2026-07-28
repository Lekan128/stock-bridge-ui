import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/constants/orderStatus'

/**
 * Mirrors Spring Data's Page<T>. Declared here rather than imported from the products feature so
 * orders and inventory stay independent of each other's DTO modules — the shape is nine lines and
 * belongs to Spring, not to either feature.
 */
export interface PageResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first: boolean
  last: boolean
}

/**
 * ⚠️ `spring.jackson.default-property-inclusion: non_null` is set app-wide, so every nullable
 * column is *omitted* from the JSON rather than sent as `null`. Optional properties (`?:`) are
 * therefore the correct typing throughout this file — `| null` would be a lie the compiler
 * would happily let you `=== null` against forever.
 */

/** One line of an order, rendered entirely from the snapshot taken at checkout. */
export interface OrderItem {
  id: string
  /** The ProcurePal catalog product — use it to link back to the storefront listing. */
  productId: string
  /** The buyer's OWN product row this line feeds. This is what carries `incomingQuantity`. */
  buyerProductId?: string
  productName: string
  productSku?: string
  unitOfMeasure?: string
  imageUrl?: string
  unitPrice: number
  quantity: number
  receivedQuantity: number
  /** Exactly the amount still sitting as incoming stock on the buyer's product row. */
  outstandingQuantity: number
  lineTotal: number
}

export interface OrderStatusEvent {
  id: string
  /** Absent on the order's creation event. */
  fromStatus?: OrderStatus
  toStatus: OrderStatus
  note?: string
  /** Absent for a system transition (verified payment, abandoned-checkout sweep). */
  createdBy?: string
  createdAt: string
}

/** The shipping details as they were at checkout — never re-read from the address book. */
export interface OrderDelivery {
  addressId?: string
  label?: string
  contactName: string
  contactPhone: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  landmark?: string
  notes?: string
}

export interface OrderCustomer {
  clientId: string
  name: string
  slug: string
  phone?: string
  email?: string
  paymentTerms?: string
}

export interface Order {
  id: string
  orderNumber: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod
  currency: string
  subtotal: number
  deliveryFee: number
  total: number
  delivery: OrderDelivery
  customerNote?: string
  cancellationReason?: string
  items: OrderItem[]
  events: OrderStatusEvent[]
  /** Populated only for ProcurePal's fulfilment view; always absent for the buyer. */
  customer?: OrderCustomer
  placedByUserId?: string
  placedByUsername?: string
  itemCount: number
  distinctItemCount: number
  fullyReceived: boolean
  /**
   * Server-computed. The state machine lives on the backend and a frontend copy of it drifts —
   * every button on the detail page is driven off these three fields and nothing else.
   */
  canCancel: boolean
  canReceive: boolean
  allowedNextStatuses: OrderStatus[]
  placedAt?: string
  confirmedAt?: string
  dispatchedAt?: string
  deliveredAt?: string
  receivedAt?: string
  cancelledAt?: string
  createdAt: string
  updatedAt: string
}

/** List-row projection: no items, no events. */
export interface OrderSummary {
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
  deliveryCity?: string
  deliveryState?: string
  customer?: OrderCustomer
  placedAt?: string
  createdAt: string
}

export interface OrderListParams {
  status?: OrderStatus
  page?: number
  size?: number
}

export interface ReceiveOrderLine {
  orderItemId: string
  quantity: number
}

/** An absent/empty `lines` means "everything still outstanding" — the common case. */
export interface ReceiveOrderPayload {
  lines?: ReceiveOrderLine[]
}

export interface SkippedReorderLine {
  productId: string
  productName: string
  reason: string
}

export interface ReorderResult {
  /** The server cart after the merge. Shape belongs to the cart feature; we only need the count. */
  cart: { itemCount: number; distinctItemCount: number }
  addedCount: number
  skipped?: SkippedReorderLine[]
}

export interface InitializePaymentResult {
  checkoutUrl: string
  paymentReference: string
  transactionReference: string
}
