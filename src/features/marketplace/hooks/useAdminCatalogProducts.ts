import { useCallback, useEffect, useState } from 'react'
import { marketplaceAdminApi } from '@/features/marketplace/api/marketplaceAdminApi'
import type { AdminCatalogProduct, AdminProductListParams, PageResponse } from '@/features/marketplace/types'
import { isAppError } from '@/types/api'

/**
 * A page of ProcurePal's catalog with its listing state.
 *
 * `patchProduct` exists so the per-row listing toggle can apply optimistically and roll back on
 * failure without refetching the page — a refetch would jump the row out from under the cursor
 * when the current filter is "Listed only" and the operator just unlisted something.
 */
export function useAdminCatalogProducts(params: AdminProductListParams) {
  const [data, setData] = useState<PageResponse<AdminCatalogProduct> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const paramsKey = JSON.stringify(params)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    marketplaceAdminApi
      .products(params)
      .then((response) => {
        if (!cancelled) setData(response)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setData(null)
          setError(isAppError(err) ? err.message : 'Could not load the catalog. Please try again.')
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

  const patchProduct = useCallback((id: string, patch: Partial<AdminCatalogProduct>) => {
    setData((current) =>
      current
        ? {
            ...current,
            content: current.content.map((product) => (product.id === id ? { ...product, ...patch } : product)),
          }
        : current,
    )
  }, [])

  const replaceProduct = useCallback((next: AdminCatalogProduct) => {
    setData((current) =>
      current
        ? { ...current, content: current.content.map((product) => (product.id === next.id ? next : product)) }
        : current,
    )
  }, [])

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])

  return { data, loading, error, refetch, patchProduct, replaceProduct }
}
