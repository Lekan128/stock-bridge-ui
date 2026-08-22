import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/constants/orderStatus'

/**
 * Checkout, order and payment shapes (contract §7, §9, plus ADDENDUM 4).
 *
 * Every nullable field is declared optional rather than `| null`. The API runs with
 * `spring.jackson.default-property-inclusion: non_null`, so an absent value is *missing from the
 * JSON*, not null — `address.landmark ?? fallback` works, `address.landmark === null` never fires.
 */

/** `GET /api/delivery-addresses` (structurally assignable to `AddressCardAddress`). */
export interface DeliveryAddress {
  id: string
  label: string
  contactName: string
  contactPhone: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  landmark?: string
  deliveryNotes?: string
  branchId?: string
  branchName?: string
  isDefault: boolean
  active: boolean
  createdAt?: string
  updatedAt?: string
}

/** Create payload, shared by `POST /api/delivery-addresses` and the inline checkout form. */
export interface DeliveryAddressPayload {
  label: string
  contactName: string
  contactPhone: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  landmark?: string
  deliveryNotes?: string
  branchId?: string
  makeDefault?: boolean
}

/** A cart line the server will not sell right now, and why. */
export interface UnavailableLine {
  productId: string
  productName: string
  reason: string
}

/**
 * `POST /api/checkout/quote`. The single source of truth for what checkout costs and what is
 * stopping it — `blockers` and `payOnDeliveryReasons` are human-facing sentences meant to be
 * rendered verbatim as the "why is this disabled" copy (contract §10). Re-deriving those rules
 * client-side is how a UI ends up disagreeing with the server about whether an order is allowed.
 */
export interface CheckoutQuote {
  currency: string
  subtotal: number
  deliveryFee: number
  total: number
  itemCount: number
  distinctItemCount: number
  freeDeliveryThreshold: number
  amountToFreeDelivery: number
  freeDeliveryApplied: boolean
  minimumOrderValue: number
  meetsMinimumOrderValue: boolean
  canCheckout: boolean
  blockers: string[]
  payOnDeliveryEligible: boolean
  payOnDeliveryReasons: string[]
  payOnDeliveryMaxOrderValue?: number
  deliveryAddress?: DeliveryAddress
  unavailableItems: UnavailableLine[]
  /**
   * One entry per seller in the basket, in the order the resulting orders will be created.
   *
   * A single-seller basket has exactly one, so the UI renders the grouped layout unconditionally
   * rather than branching on a count. The top-level `subtotal`/`deliveryFee`/`total` remain the
   * basket-wide sums — what the buyer actually pays, in one transaction.
   *
   * These figures are authoritative and must be rendered as given. Delivery is charged PER SELLER
   * server-side, so a UI that summed the goods itself and applied one fee would quote a total the
   * order then refuses.
   */
  sellerGroups: CheckoutSellerGroup[]
}

/**
 * What one seller's share of the basket costs — and therefore what one of the resulting orders
 * will look like.
 *
 * Carries the seller's name and logo but no commission rate: what the platform charges a vendor is
 * between the platform and the vendor, and it is not on the wire.
 */
export interface CheckoutSellerGroup {
  sellerId: string
  sellerName: string
  sellerSlug: string | null
  sellerLogoUrl: string | null
  platformOwner: boolean
  itemCount: number
  distinctItemCount: number
  subtotal: number
  deliveryFee: number
  total: number
  freeDeliveryApplied: boolean
}

/**
 * `POST /api/orders`. Exactly one of `deliveryAddressId` / `newAddress` is sent. No lines, no
 * prices: the server builds the order from its own cart and the live catalog.
 */
export interface PlaceOrderPayload {
  paymentMethod: PaymentMethod
  deliveryAddressId?: string
  newAddress?: DeliveryAddressPayload
  saveAddress?: boolean
  customerNote?: string
}

/** The address as it was snapshotted onto the order — never re-read through `addressId`. */
export interface OrderDelivery {
  addressId?: string
  label?: string
  contactName?: string
  contactPhone?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  landmark?: string
  notes?: string
}

export interface OrderItem {
  id: string
  productId?: string
  /** The buyer's own product row this line writes stock into. */
  buyerProductId?: string
  productName: string
  productSku?: string
  unitOfMeasure?: string
  imageUrl?: string
  unitPrice: number
  quantity: number
  receivedQuantity: number
  /** Still sitting as incoming stock on the buyer's product row. */
  outstandingQuantity: number
  lineTotal: number
}

export interface OrderStatusEvent {
  id: string
  fromStatus?: OrderStatus
  toStatus: OrderStatus
  note?: string
  createdBy?: string
  createdAt: string
}

/** Who fulfilled an order, as its buyer may see them — name and logo only. */
export interface OrderSeller {
  id: string
  name: string
  slug: string | null
  logoUrl: string | null
  platformOwner: boolean
}

/**
 * Another order from the same checkout — enough to say "and this one, from that seller, for this
 * much" and link to it.
 *
 * Deliberately shallow: `Order` carries its own siblings, so nesting full orders would recurse.
 */
export interface SiblingOrder {
  id: string
  orderNumber: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  total: number
  seller: OrderSeller | null
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
  /** Who is fulfilling this order. Null only if the seller row was hard-deleted. */
  seller: OrderSeller | null
  /**
   * The basket this order came out of. Orders sharing this value were placed by one press of one
   * button and paid for with one transaction.
   */
  checkoutGroupId: string
  /** The OTHER orders that checkout produced — empty for an ordinary single-seller basket. */
  siblingOrders: SiblingOrder[]
  delivery: OrderDelivery
  customerNote?: string
  cancellationReason?: string
  items: OrderItem[]
  events: OrderStatusEvent[]
  placedByUserId?: string
  placedByUsername?: string
  itemCount: number
  distinctItemCount: number
  fullyReceived: boolean
  /** Server-computed. Never re-derive the state machine on the client (contract §5). */
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

/** `POST /api/payments/monnify/initialize`. `checkoutUrl` dies 40 minutes after issue. */
export interface InitializePaymentResponse {
  checkoutUrl: string
  paymentReference: string
  transactionReference?: string
}

/**
 * The provider status of one payment ATTEMPT, as the server concluded after re-asking Monnify.
 * ABANDONED and FAILED are kept apart deliberately: "the buyer walked away" is not "the bank
 * declined", and the retry copy differs.
 */
export type PaymentProviderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'ABANDONED' | 'REVERSED'

/**
 * `GET /api/payments/{paymentReference}/verify`.
 *
 * ⚠️ Field names differ from the condensed frontend contract: the order-level payment status is
 * `orderPaymentStatus` (not `paymentStatus`) and there is **no** `paymentMethodUsed` field. Both
 * verified against `PaymentVerificationResponse.java` and a live call.
 */
export interface PaymentVerification {
  paymentReference: string
  transactionReference?: string
  status: PaymentProviderStatus
  orderId: string
  orderNumber: string
  orderStatus: OrderStatus
  orderPaymentStatus: PaymentStatus
  amount: number
  amountPaid?: number
  paidAt?: string
  /** Server-authored explanation, safe to render verbatim. */
  message?: string
}
