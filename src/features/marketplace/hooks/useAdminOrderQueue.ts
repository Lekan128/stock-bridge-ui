import { useCallback, useEffect, useState } from 'react'
import { marketplaceAdminApi } from '@/features/marketplace/api/marketplaceAdminApi'
import type { AdminOrderQueueParams, AdminOrderSummary, PageResponse } from '@/features/marketplace/types'
import { isAppError } from '@/types/api'

/**
 * One page of ProcurePal's fulfilment queue. Hand-rolled loading/error/data + refetch, matching
 * `useProducts` — this codebase has no react-query and must not grow one.
 *
 * `previousData` is kept while a new page or filter loads so the table can dim rather than collapse
 * to a skeleton on every keystroke of the customer search. An ops screen that flickers its whole
 * body on each filter change is unusable at the pace people actually work.
 */
export function useAdminOrderQueue(params: AdminOrderQueueParams) {
  const [data, setData] = useState<PageResponse<AdminOrderSummary> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const paramsKey = JSON.stringify(params)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    marketplaceAdminApi
      .orders(params)
      .then((response) => {
        if (!cancelled) setData(response)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setData(null)
          setError(isAppError(err) ? err.message : 'Could not load the order queue. Please try again.')
        }
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

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])

  return { data, loading, error, refetch, reloadToken }
}
