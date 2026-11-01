import { api } from '@/api/client'
import type { PageResponse } from '@/features/products/types'
import type { ReceiptPayload, SendPayload, Transfer } from '@/features/transfers/types'

/**
 * Transfers between branches. Sending and receiving go through the outbox (`submitTransfer`), so they
 * work offline; closing, cancelling and checking missing stock are decisions made online.
 */
export const transfersApi = {
  list: (params: { branchId?: string; openOnly?: boolean; page?: number; size?: number }) =>
    api.get<PageResponse<Transfer>>('/api/stock-transfers', { params }).then((r) => r.data),
  get: (id: string) => api.get<Transfer>(`/api/stock-transfers/${id}`).then((r) => r.data),
  send: (payload: SendPayload) => api.post<Transfer>('/api/stock-transfers', payload).then((r) => r.data),
  receive: (id: string, payload: ReceiptPayload) =>
    api.post<Transfer>(`/api/stock-transfers/${id}/receipts`, payload).then((r) => r.data),
  close: (id: string) => api.post<Transfer>(`/api/stock-transfers/${id}/close`).then((r) => r.data),
  cancel: (id: string) => api.post<Transfer>(`/api/stock-transfers/${id}/cancel`).then((r) => r.data),
  found: (id: string, payload: { id: string; productId: string; quantity: number; branchId: string }) =>
    api.post<Transfer>(`/api/stock-transfers/${id}/found`, payload).then((r) => r.data),
  checkMissing: (id: string, note: string) =>
    api.post<Transfer>(`/api/stock-transfers/${id}/missing-checked`, { note }).then((r) => r.data),
}
