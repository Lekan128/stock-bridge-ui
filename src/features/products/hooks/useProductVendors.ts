import { useCallback, useEffect, useState } from 'react'
import { productVendorsApi } from '@/features/products/api/productVendorsApi'
import type { ProductVendor } from '@/features/products/vendors/types'
import { isAppError } from '@/types/api'

/**
 * A product's vendor lines — the Vendors tab's one round trip. Same `data/loading/error/refetch`
 * shape as `useProduct`/`useVendor`, plus `setData` so the tab can apply an optimistic update for
 * the preferred-vendor swap and reconcile it against the server response, same pattern
 * `ProductDetailPage` already uses via `useProduct`'s `setProduct`.
 *
 * An empty array is a normal, common result (most products have zero or one vendor on file
 * today) — not distinguished from "still loading" beyond the `loading` flag itself.
 */
export function useProductVendors(productId: string | undefined) {
  const [data, setData] = useState<ProductVendor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!productId) return
    let cancelled = false
    setLoading(true)
    setError(null)

    productVendorsApi
      .list(productId)
      .then((response) => {
        if (!cancelled) setData(response)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(isAppError(err) ? err.message : 'Could not load suppliers for this product.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [productId, reloadToken])

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])

  return { data, setData, loading, error, refetch }
}
