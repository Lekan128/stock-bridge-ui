import { useEffect, useState } from 'react'
import { storefrontApi } from '@/features/storefront/api/storefrontApi'
import type { CatalogParams, MarketplaceProduct } from '@/features/storefront/types'
import type { PageResponse } from '@/features/products/types'
import { isAppError } from '@/types/api'

/**
 * One page of the public catalog. Follows the hand-rolled `useProducts` pattern (contract §8:
 * no react-query in this codebase).
 *
 * `keepPreviousData` is what stops the grid collapsing to skeletons on every keystroke of a
 * debounced search: the previous page stays on screen, dimmed by the caller, while the next one
 * loads. A catalog that flashes empty between results feels broken even when it is fast.
 */
export function useCatalog(params: CatalogParams) {
  const [data, setData] = useState<PageResponse<MarketplaceProduct> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const paramsKey = JSON.stringify(params)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    storefrontApi
      .catalog(params)
      .then((response) => {
        if (!cancelled) setData(response)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(isAppError(err) ? err.message : 'We could not load the catalog. Please try again.')
          // Deliberately not clearing `data`: an error banner over the last good results beats
          // a blank page, and the retry button re-runs this effect.
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // paramsKey is a stable stand-in for params (a fresh object every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, reloadToken])

  return {
    data,
    products: data?.content ?? [],
    loading,
    error,
    refetch: () => setReloadToken((token) => token + 1),
  }
}
