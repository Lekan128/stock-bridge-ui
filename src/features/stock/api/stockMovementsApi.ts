import { api } from '@/api/client'
import type { PageResponse, StockMovement } from '@/features/products/types'
import type { StockMovementReportParams, StockMovementSummary } from '@/features/stock/types'

/**
 * The stock in/out report. Two calls over one filter set — the rows, and what they add up to.
 *
 * The summary is a separate request rather than a field on the page response because it does not
 * change as the user pages, so folding it in would mean recomputing a whole-range aggregate on
 * every page turn.
 */
export const stockMovementsApi = {
  list: (params: StockMovementReportParams) =>
    api.get<PageResponse<StockMovement>>('/api/stock/movements', { params }).then((r) => r.data),

  summary: (params: Omit<StockMovementReportParams, 'page' | 'size' | 'sort'>) =>
    api.get<StockMovementSummary>('/api/stock/movements/summary', { params }).then((r) => r.data),
}
