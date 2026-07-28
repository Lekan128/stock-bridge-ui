import { useCallback, useEffect, useState } from 'react'
import { checkoutApi } from '@/features/checkout/api/checkoutApi'
import type { Order } from '@/features/checkout/types'
import { isAppError } from '@/types/api'

/**
 * One order, for the confirmation screen. 404 is separated from other failures because a
 * cross-tenant id also answers 404 (contract §9) — both mean "this is not your order", which is a
 * dead end, not something a retry button can fix.
 */
export function useOrder(orderId: string | undefined) {
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!orderId) {
      setLoading(false)
      setNotFound(true)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setNotFound(false)

    checkoutApi
      .order(orderId)
      .then((data) => {
        if (!cancelled) setOrder(data)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (isAppError(err) && err.status === 404) {
          setNotFound(true)
          return
        }
        setError(isAppError(err) ? err.message : 'We could not load this order. Please try again.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [orderId, reloadToken])

  const refetch = useCallback(() => setReloadToken((token) => token + 1), [])

  return { order, loading, error, notFound, refetch }
}
