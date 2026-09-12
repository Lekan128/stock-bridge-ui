import { useCallback, useEffect, useState } from 'react'
import type { PageResponse, StockMovement } from '@/features/products/types'
import { stockMovementsApi } from '@/features/stock/api/stockMovementsApi'
import type { StockMovementReportParams, StockMovementSummary } from '@/features/stock/types'
import { isAppError } from '@/types/api'

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
  const [page, setPage] = useState<PageResponse<StockMovement> | null>(null)
  const [summary, setSummary] = useState<StockMovementSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  // Paging keys are peeled off so `filters` is exactly what the summary is computed over — the
  // totals do not change as the user pages. Named with underscores because they exist only to be
  // excluded here.
  const { page: _page, size: _size, sort: _sort, ...filters } = params
  const paramsKey = JSON.stringify(params)
  const filtersKey = JSON.stringify(filters)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    stockMovementsApi
      .list(params)
      .then((response) => {
        if (!cancelled) setPage(response)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(isAppError(err) ? err.message : 'We could not load stock movements.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // paramsKey is a stable stand-in for params (a fresh object each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, reloadToken])

  useEffect(() => {
    let cancelled = false
    // Deliberately not cleared to null first: the totals are unchanged by a filter edit until the
    // new ones arrive, and blanking them makes the header jump on every keystroke of a filter.
    // A failed summary is left silent rather than surfaced — the rows are the report, and an
    // error banner over a table that loaded fine would misdescribe what went wrong.
    stockMovementsApi
      .summary(filters)
      .then((response) => {
        if (!cancelled) setSummary(response)
      })
      .catch(() => {
        if (!cancelled) setSummary(null)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, reloadToken])

  const refetch = useCallback(() => setReloadToken((token) => token + 1), [])

  return {
    movements: page?.content ?? [],
    totalPages: page?.totalPages ?? 0,
    totalElements: page?.totalElements ?? 0,
    summary,
    loading,
    error,
    refetch,
  }
}
