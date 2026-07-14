import { api } from '@/api/client'
import type {
  PageResponse,
  StockAdjustmentPayload,
  StockInPayload,
  StockMovement,
  StockMutationResponse,
  StockOutPayload,
} from '@/features/products/types'

export const stockApi = {
  stockIn: (productId: string, payload: StockInPayload) =>
    api.post<StockMutationResponse>(`/api/products/${productId}/stock/stock-in`, payload).then((r) => r.data),

  stockOut: (productId: string, payload: StockOutPayload) =>
    api.post<StockMutationResponse>(`/api/products/${productId}/stock/stock-out`, payload).then((r) => r.data),

  adjust: (productId: string, payload: StockAdjustmentPayload) =>
    api.post<StockMutationResponse>(`/api/products/${productId}/stock/adjustment`, payload).then((r) => r.data),

  history: (productId: string, page: number, size = 10) =>
    api
      .get<PageResponse<StockMovement>>(`/api/products/${productId}/stock/history`, { params: { page, size } })
      .then((r) => r.data),
}
