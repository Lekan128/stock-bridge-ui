import { api } from '@/api/client'
import { viewingBranchId } from '@/features/branches/viewingBranch'
import type { SaleDetail, SalesReport, SalesReportParams } from '@/features/selling/sales/types'

/** At a branch, that branch's sales (V51); in "All branches" or a one-branch company, every branch's. */
function query({ from, to, groupBy, filter, productId }: SalesReportParams) {
  return { from, to, groupBy, productId, branchId: viewingBranchId(), ...(filter ? { [filter]: true } : {}) }
}

/** The Sales report and the fixes a sale can take (`SELLING_PRICE_PLAN.md` §4.3a, §6.11). */
export const salesReportApi = {
  report: (params: SalesReportParams) =>
    api.get<SalesReport>('/api/analytics/sales', { params: query(params) }).then((r) => r.data),

  export: (params: SalesReportParams) =>
    api.get('/api/analytics/sales/export', { params: query(params), responseType: 'blob' }).then((r) => r.data as Blob),

  sale: (saleId: string) => api.get<SaleDetail>(`/api/sales/${saleId}`).then((r) => r.data),

  /** Every line not already cancelled, or just `lineIds`. Online only - it reverses a shared fact. */
  cancel: (saleId: string, lineIds?: string[]) =>
    api.post<SaleDetail>(`/api/sales/${saleId}/cancel`, { lineIds: lineIds ?? null }).then((r) => r.data),

  /** The price for a line saved without one: per unit as typed, or what the whole line went for. */
  addPrice: (lineId: string, body: { unitPrice?: number; lineTotal?: number }) =>
    api.post<SaleDetail>(`/api/sales/lines/${lineId}/price`, body).then((r) => r.data),

  undo: (saleId: string) =>
    api.post<{ lines: { productName: string; undone: boolean; reason?: string }[] }>(`/api/sales/${saleId}/undo`).then((r) => r.data),
}
