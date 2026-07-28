import { useCallback, useEffect, useState } from 'react'
import { ordersApi } from '@/features/orders/api/ordersApi'
import type { OrderListParams, OrderSummary, PageResponse } from '@/features/orders/types'
import { isAppError } from '@/types/api'

/**
 * Hand-rolled fetch hook, following `useProducts` — there is no react-query in this app and one
 * must not be added.
 */
export function useOrders(params: OrderListParams) {
  const [data, setData] = useState<PageResponse<OrderSummary> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const paramsKey = JSON.stringify(params)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    ordersApi
      .list(params)
      .then((response) => {
        if (!cancelled) setData(response)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(isAppError(err) ? err.message : 'Could not load your orders. Please try again.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // paramsKey is a stable stand-in for params (a fresh object every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, reloadToken])

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])

  return { data, loading, error, refetch }
}
