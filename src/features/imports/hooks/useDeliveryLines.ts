import { useCallback, useEffect, useState } from 'react'
import { importsApi } from '@/features/imports/api/importsApi'
import { copy } from '@/features/imports/copy'
import type { DeliveryLine, StockInFilter } from '@/features/imports/types'
import { isAppError } from '@/types/api'

/**
 * The lines the "Record a delivery" screen lists: every product, or one supplier's. `vendorId`
 * is ignored unless `filter` is BY_VENDOR, the same rule the stock sheet download follows.
 */
export function useDeliveryLines(filter: StockInFilter, vendorId?: string) {
  const [lines, setLines] = useState<DeliveryLine[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    importsApi
      .deliveryLines({ filter, vendorId })
      .then((response) => {
        if (!cancelled) setLines(response)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(isAppError(err) ? err.message : copy.delivery.loadFailed)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [filter, vendorId, reloadToken])

  const refetch = useCallback(() => setReloadToken((token) => token + 1), [])

  return { lines, loading, error, refetch }
}
