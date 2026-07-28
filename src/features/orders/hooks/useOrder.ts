import { useCallback, useEffect, useState } from 'react'
import { ordersApi } from '@/features/orders/api/ordersApi'
import type { Order } from '@/features/orders/types'
import { isAppError } from '@/types/api'

export function useOrder(id: string | undefined) {
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      setError('No order was specified.')
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)

    ordersApi
      .get(id)
      .then((response) => {
        if (!cancelled) setOrder(response)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          // A cross-tenant id answers 404 on purpose — it must not leak that the order exists.
          setError(isAppError(err) ? err.message : 'Could not load this order. Please try again.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id, reloadToken])

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])

  return { order, setOrder, loading, error, refetch }
}
