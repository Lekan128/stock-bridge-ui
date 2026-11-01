import { api } from '@/api/client'
import type { PageResponse } from '@/features/products/types'
import type { NoneInStoreLine, StockRequest, StockRequestPayload } from '@/features/requests/types'

/** Asking another area for stock (STOCK_AREAS_PART_5.md). Asking goes through the outbox; answering is online. */
export const requestsApi = {
  ask: (payload: StockRequestPayload) => api.post<StockRequest>('/api/stock-requests', payload).then((r) => r.data),
  get: (id: string) => api.get<StockRequest>(`/api/stock-requests/${id}`).then((r) => r.data),
  list: (params: { branchId?: string; page?: number; size?: number }) =>
    api.get<PageResponse<StockRequest>>('/api/stock-requests', { params }).then((r) => r.data),
  /** The open requests this person can fill. */
  waiting: (branchId?: string) =>
    api.get<StockRequest[]>('/api/stock-requests/waiting', { params: branchId ? { branchId } : {} }).then((r) => r.data),
  /** "None in the store" for these lines. */
  noneInStore: (id: string, productIds: string[]) =>
    api.post<StockRequest>(`/api/stock-requests/${id}/none-in-store`, { productIds }).then((r) => r.data),
  cancel: (id: string) => api.post<StockRequest>(`/api/stock-requests/${id}/cancel`).then((r) => r.data),
  /** Lines asked for that the store has none of, for the people who buy. */
  noneInStoreLines: (branchId?: string) =>
    api
      .get<NoneInStoreLine[]>('/api/stock-requests/none-in-store', { params: branchId ? { branchId } : {} })
      .then((r) => r.data),
}
