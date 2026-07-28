import type { BadgeVariant } from '@/components/Badge'

/**
 * Mirror of the order state machine in contract §5. Orders track two independent axes:
 * `status` is fulfilment progress, `paymentStatus` is money. They deliberately do not
 * collapse into one field — a pay-on-delivery order is PLACED long before it is PAID, and a
 * Monnify order is PAID before ProcurePal has confirmed it.
 *
 * These unions live in `constants/` rather than in a feature's `types.ts` because the status
 * badges, the tracking timeline, the buyer's order list and ProcurePal's fulfilment queue all
 * need them, and none of those features should own the vocabulary the others depend on.
 */
export const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'PLACED',
  'CONFIRMED',
  'PROCESSING',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'RECEIVED',
  'CANCELLED',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

/**
 * The happy path, in order, for the tracking timeline. CANCELLED is excluded on purpose:
 * it is a terminal branch off any state, not a step, so the timeline renders it as a
 * replacement for the remaining steps rather than as one of them.
 */
export const ORDER_STATUS_SEQUENCE: readonly OrderStatus[] = [
  'PENDING_PAYMENT',
  'PLACED',
  'CONFIRMED',
  'PROCESSING',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'RECEIVED',
]

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Awaiting payment',
  PLACED: 'Order placed',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Being prepared',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  RECEIVED: 'Received into inventory',
  CANCELLED: 'Cancelled',
}

/**
 * Colour mapping, consistent with the storefront language: amber = waiting on someone,
 * navy = in flight and on track, emerald = done/good, red = dead.
 */
export const ORDER_STATUS_VARIANTS: Record<OrderStatus, BadgeVariant> = {
  PENDING_PAYMENT: 'warning',
  PLACED: 'info',
  CONFIRMED: 'info',
  PROCESSING: 'info',
  OUT_FOR_DELIVERY: 'info',
  DELIVERED: 'success',
  RECEIVED: 'success',
  CANCELLED: 'danger',
}

/** True once the buyer's incoming stock has been created (contract §5, the PLACED transition). */
export function hasIncomingStock(status: OrderStatus): boolean {
  return status !== 'PENDING_PAYMENT' && status !== 'CANCELLED'
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return status === 'RECEIVED' || status === 'CANCELLED'
}

export const PAYMENT_STATUSES = ['PENDING', 'ON_DELIVERY', 'PAID', 'FAILED', 'REFUNDED'] as const

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Payment pending',
  ON_DELIVERY: 'Pay on delivery',
  PAID: 'Paid',
  FAILED: 'Payment failed',
  REFUNDED: 'Refunded',
}

export const PAYMENT_STATUS_VARIANTS: Record<PaymentStatus, BadgeVariant> = {
  PENDING: 'warning',
  ON_DELIVERY: 'warning',
  PAID: 'success',
  FAILED: 'danger',
  REFUNDED: 'neutral',
}

/**
 * Checkout entry points (contract §5). The contract fixes the two behaviours but not the
 * exact column values for `orders.payment_method`; M1's migration is authoritative, and if it
 * chooses different strings this constant is the single place to change.
 */
export const PAYMENT_METHODS = ['MONNIFY', 'PAY_ON_DELIVERY'] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  MONNIFY: 'Pay now (card, transfer or USSD)',
  PAY_ON_DELIVERY: 'Pay on delivery',
}
