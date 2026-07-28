import { api } from '@/api/client'
import type {
  InitializePaymentResult,
  Order,
  OrderListParams,
  OrderSummary,
  PageResponse,
  ReceiveOrderPayload,
  ReorderResult,
} from '@/features/orders/types'

export const ordersApi = {
  /**
   * `GET /api/orders` binds a real Spring `Pageable`, so `page`/`size` are the right params here.
   * (The *marketplace catalog* is the endpoint with hand-bound pagination — don't confuse them.)
   * `status` is a single enum value; the backend has no multi-status filter.
   */
  list: (params: OrderListParams) =>
    api.get<PageResponse<OrderSummary>>('/api/orders', { params }).then((r) => r.data),

  get: (id: string) => api.get<Order>(`/api/orders/${id}`).then((r) => r.data),

  cancel: (id: string, reason: string) =>
    api.post<Order>(`/api/orders/${id}/cancel`, { reason }).then((r) => r.data),

  /** The pivotal call: turns incoming stock into usable on-hand stock. Returns the updated order. */
  receive: (id: string, payload: ReceiveOrderPayload) =>
    api.post<Order>(`/api/orders/${id}/receive`, payload).then((r) => r.data),

  reorder: (id: string) => api.post<ReorderResult>(`/api/orders/${id}/reorder`).then((r) => r.data),

  /**
   * Always call this fresh — a Monnify checkout URL expires 40 minutes after issue, so a cached
   * one from the original checkout is worthless by the time a buyer comes back to retry.
   * 409 = the order is already paid; 503 = Monnify is not configured on this deployment.
   */
  initializePayment: (orderId: string) =>
    api.post<InitializePaymentResult>('/api/payments/monnify/initialize', { orderId }).then((r) => r.data),
}
