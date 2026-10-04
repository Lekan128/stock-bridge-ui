import { useCallback } from 'react'
import { queryKeys } from '@/data/queryKeys'
import { useApiQuery } from '@/data/useApiQuery'
import type { PageResponse, StockMovement } from '@/features/products/types'
import { stockMovementsApi } from '@/features/stock/api/stockMovementsApi'
import type { StockMovementReportParams, StockMovementSummary } from '@/features/stock/types'

/**
 * The rows and the totals of the stock in/out report, fetched together.
 *
 * <h2>Why one hook and not two</h2>
 * The two requests must always be made over the same filters — a footer computed over a different
 * filter set than the table above it is worse than no footer. Keeping them in one hook makes that
 * structural rather than a convention two call sites have to remember. The summary is still
 * skipped on a page turn: paging does not change what the range adds up to, so re-aggregating the
 * whole range on every "next" would be wasted work and a visibly flickering total.
 */
export function useStockMovementReport(params: StockMovementReportParams) {
  const { page: _page, size: _size, sort: _sort, ...filters } = params

  const rows = useApiQuery<PageResponse<StockMovement>>({
    queryKey: queryKeys.stockMovements.list(params),
    queryFn: () => stockMovementsApi.list(params),
    fallbackError: 'We could not load stock movements.',
    keepPrevious: true,
  })
  // The totals answer the filters, not the page, so paging through the rows never refetches them.
  const totals = useApiQuery<StockMovementSummary>({
    queryKey: queryKeys.stockMovements.summary(filters),
    queryFn: () => stockMovementsApi.summary(filters),
    fallbackError: 'We could not load the totals.',
    keepPrevious: true,
  })

  const { refetch: refetchRows } = rows
  const { refetch: refetchTotals } = totals
  const refetch = useCallback(() => {
    refetchRows()
    refetchTotals()
  }, [refetchRows, refetchTotals])

  return {
    movements: rows.data?.content ?? [],
    totalPages: rows.data?.totalPages ?? 0,
    totalElements: rows.data?.totalElements ?? 0,
    // A failed summary was always shown as "no totals" rather than as an error.
    summary: totals.error != null ? null : (totals.data ?? null),
    // The report page uses this for its first-load skeleton and to dim rows mid-refresh.
    loading: rows.loading || rows.fetching,
    error: rows.error,
    refetch,
  }
}
