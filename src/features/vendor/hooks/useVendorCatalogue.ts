import { useCallback, useEffect, useState } from 'react'
import { vendorCatalogueApi } from '@/features/vendor/api/vendorCatalogueApi'
import type { VendorCataloguePage } from '@/features/vendor/types'
import { isAppError } from '@/types/api'

const EMPTY: VendorCataloguePage = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }

/**
 * The seller's own catalogue, paged.
 *
 * Hand-rolled loading/error/data with a cancelled flag, matching `useAddresses` and the rest
 * of this codebase — there is no react-query here and this module does not introduce one.
 *
 * `page` is reset by the caller when the filters change, not here: this hook does not own the
 * filter state, and resetting a page number it was merely handed would make the caller's own
 * state and the request disagree for one render.
 */
export function useVendorCatalogue(params: { q?: string; listed?: boolean; page: number; size: number }) {
  const [data, setData] = useState<VendorCataloguePage>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const paramsKey = JSON.stringify(params)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    vendorCatalogueApi
      .products(JSON.parse(paramsKey) as typeof params)
      .then((page) => {
        if (!cancelled) setData(page)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(isAppError(err) ? err.message : 'Could not load your catalogue.')
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

  const refetch = useCallback(() => setReloadToken((n) => n + 1), [])

  return { page: data, setPage: setData, loading, error, refetch }
}
