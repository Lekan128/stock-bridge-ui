import { useCallback, useEffect, useState } from 'react'
import type { PageResponse } from '@/features/products/types'
import { vendorsApi } from '@/features/vendors/api/vendorsApi'
import type { VendorPurchase } from '@/features/vendors/types'
import { isAppError } from '@/types/api'

/**
 * A vendor's purchase history, paginated by ORDER.
 *
 * Always an empty page for an EXTERNAL supplier — they have no orders on this platform and never
 * will. That is not a loading failure and the screen must not present it as one; see
 * `EmptyVendorPurchasesState`, which says so in words.
 */
export function useVendorPurchases(vendorId: string | undefined, page: number) {
  const [data, setData] = useState<PageResponse<VendorPurchase> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!vendorId) return
    let cancelled = false
    setLoading(true)
    setError(null)

    vendorsApi
      .purchases(vendorId, page)
      .then((response) => {
        if (!cancelled) setData(response)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(isAppError(err) ? err.message : 'Could not load this purchase history.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [vendorId, page, reloadToken])

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])

  return { data, loading, error, refetch }
}
