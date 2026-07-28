import { useCallback, useEffect, useState } from 'react'
import { marketplaceAdminApi } from '@/features/marketplace/api/marketplaceAdminApi'
import type { AdminOrder } from '@/features/marketplace/types'
import { isAppError } from '@/types/api'

/**
 * One order for the fulfilment detail screen.
 *
 * `setOrder` is returned alongside the usual triple because every mutation on that page
 * (`/status`, `/payment-received`) responds with the *whole* updated order. Feeding that straight
 * back in is both faster and more truthful than a refetch: the response already reflects the
 * transition, including the new `allowedNextStatuses` the buttons are driven from.
 */
export function useAdminOrder(id: string | undefined) {
  const [order, setOrder] = useState<AdminOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!id) {
      setOrder(null)
      setLoading(false)
      setError('No order was specified.')
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    marketplaceAdminApi
      .order(id)
      .then((data) => {
        if (!cancelled) setOrder(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setOrder(null)
          setError(
            isAppError(err)
              ? err.status === 404
                ? 'That order does not exist, or it is not one of ProcurePal’s.'
                : err.message
              : 'Could not load this order. Please try again.',
          )
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
