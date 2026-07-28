import { api } from '@/api/client'
import type {
  CheckoutQuote,
  DeliveryAddress,
  DeliveryAddressPayload,
  InitializePaymentResponse,
  Order,
  PaymentVerification,
  PlaceOrderPayload,
} from '@/features/checkout/types'

/**
 * Everything the buying flow talks to (contract §7, §9).
 *
 * The delivery-address read lives here rather than being imported from the addresses feature so
 * checkout has no dependency on the address book's own module — the two ship independently, and
 * checkout must not break because the address book's DTO moved.
 */
export const checkoutApi = {
  /**
   * `deliveryAddressId` is optional: without one the server prices against the company's default
   * address, so the summary is correct before the buyer has touched the picker. POST, not GET,
   * precisely so the total can never be cached.
   */
  quote: (deliveryAddressId?: string) =>
    api
      .post<CheckoutQuote>('/api/checkout/quote', deliveryAddressId ? { deliveryAddressId } : {})
      .then((r) => r.data),

  addresses: () => api.get<DeliveryAddress[]>('/api/delivery-addresses').then((r) => r.data),

  createAddress: (payload: DeliveryAddressPayload) =>
    api.post<DeliveryAddress>('/api/delivery-addresses', payload).then((r) => r.data),

  placeOrder: (payload: PlaceOrderPayload) => api.post<Order>('/api/orders', payload).then((r) => r.data),

  order: (id: string) => api.get<Order>(`/api/orders/${id}`).then((r) => r.data),

  /**
   * Mints a FRESH transaction every time. Never reuse a stored `checkoutUrl` — Monnify expires it
   * 40 minutes after issue, so "retry payment" has to come back through here (contract §9).
   * 409 = the order is already paid. 503 = Monnify is not configured; degrade to pay-on-delivery.
   */
  initializePayment: (orderId: string) =>
    api.post<InitializePaymentResponse>('/api/payments/monnify/initialize', { orderId }).then((r) => r.data),

  /** Server-side re-verification. The outcome comes from Monnify, never from the query string. */
  verifyPayment: (paymentReference: string) =>
    api
      .get<PaymentVerification>(`/api/payments/${encodeURIComponent(paymentReference)}/verify`)
      .then((r) => r.data),
}
