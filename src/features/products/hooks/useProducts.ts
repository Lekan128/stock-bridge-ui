import { queryKeys } from '@/data/queryKeys'
import { useApiQuery } from '@/data/useApiQuery'
import { productsApi } from '@/features/products/api/productsApi'
import type { PageResponse, Product, ProductListParams } from '@/features/products/types'

/**
 * One page of the Inventory list, cached (A2). The page on screen stays while a new search,
 * filter or page loads, and the last answer is shown at once on a revisit — or offline.
 */
export function useProducts(params: ProductListParams, { enabled = true }: { enabled?: boolean } = {}) {
  const result = useApiQuery<PageResponse<Product>>({
    queryKey: queryKeys.products.list(params),
    queryFn: () => productsApi.list(params),
    fallbackError: 'Something went wrong. Please try again.',
    keepPrevious: true,
    // Off while the Inventory page reads the on-device catalogue instead (A3).
    enabled,
    // A typed search is a key nobody asks for twice; not worth keeping on the device.
    persist: !params.search,
  })

  return {
    data: result.data ?? null,
    // The list page uses this both for its first-load skeleton (with no data) and to dim the
    // rows while a new answer loads (with data), so it covers any request in flight.
    loading: result.loading || result.fetching,
    error: result.error,
    showingSaved: result.showingSaved,
    updatedAt: result.updatedAt,
    refetch: result.refetch,
  }
}
