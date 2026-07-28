import { useCallback, useEffect, useState } from 'react'
import { ordersApi } from '@/features/orders/api/ordersApi'

/**
 * How many orders are DELIVERED but not yet confirmed received.
 *
 * A separate one-row query rather than counting the rows on screen: the banner has to be right
 * while the buyer is filtered to `CANCELLED` on page 3, and `totalElements` on a `size=1` page is
 * the cheapest exact answer the API can give. (Same trick the notification bell uses for unread.)
 */
export function useAwaitingReceiptCount() {
  const [count, setCount] = useState(0)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false

    ordersApi
      .list({ status: 'DELIVERED', page: 0, size: 1 })
      .then((page) => {
        if (!cancelled) setCount(page.totalElements)
      })
      .catch(() => {
        // Silent: this is a nudge, not content. Failing to load it must not put an error on a
        // page whose actual list rendered perfectly well.
        if (!cancelled) setCount(0)
      })

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])

  return { count, refetch }
}
