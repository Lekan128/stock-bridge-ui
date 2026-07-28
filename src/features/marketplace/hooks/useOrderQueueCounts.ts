import { useEffect, useState } from 'react'
import { ORDER_STATUSES, type OrderStatus } from '@/constants/orderStatus'
import { marketplaceAdminApi } from '@/features/marketplace/api/marketplaceAdminApi'
import type { AdminOrderQueueParams } from '@/features/marketplace/types'

export type OrderQueueCounts = Partial<Record<OrderStatus | 'ALL', number>>

/**
 * The numbers on the queue's status pills.
 *
 * There is no bespoke counts endpoint, and inventing one on the client is not an option — so this
 * asks the queue itself, once per status, with `size: 1` and reads `totalElements`. Nine cheap
 * count queries fire in parallel and the rows are thrown away.
 *
 * Two deliberate choices:
 *  - The counts respect every filter *except* status, so "New 12" means "12 new orders matching
 *    what you are currently looking at" rather than a global number that contradicts the table.
 *  - A failure is swallowed and the pills simply render without numbers. The queue is the screen;
 *    its decoration must never be able to break it.
 */
export function useOrderQueueCounts(
  filters: Omit<AdminOrderQueueParams, 'status' | 'page' | 'size'>,
  reloadToken: number,
) {
  const [counts, setCounts] = useState<OrderQueueCounts>({})
  const filtersKey = JSON.stringify(filters)

  useEffect(() => {
    let cancelled = false

    const requests = [...ORDER_STATUSES].map((status) =>
      marketplaceAdminApi
        .orders({ ...filters, status, size: 1 })
        .then((page) => [status, page.totalElements] as const)
        .catch(() => null),
    )
    const allRequest = marketplaceAdminApi
      .orders({ ...filters, size: 1 })
      .then((page) => ['ALL', page.totalElements] as const)
      .catch(() => null)

    Promise.all([...requests, allRequest]).then((results) => {
      if (cancelled) return
      const next: OrderQueueCounts = {}
      for (const result of results) {
        if (result) next[result[0]] = result[1]
      }
      setCounts(next)
    })

    return () => {
      cancelled = true
    }
    // filtersKey is a stable stand-in for filters (a fresh object each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, reloadToken])

  return counts
}
