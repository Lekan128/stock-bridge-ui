import { useCallback, type SetStateAction } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { syncProductIntoCache } from '@/data/inventoryCache'
import { queryKeys } from '@/data/queryKeys'
import { useApiQuery } from '@/data/useApiQuery'
import { productsApi } from '@/features/products/api/productsApi'
import type { Product } from '@/features/products/types'

export interface UseProductOptions {
  /** Ignore cached copies; see `ApiQueryOptions.requireFresh`. The edit form sets this. */
  requireFresh?: boolean
}

export function useProduct(id: string | undefined, { requireFresh = false }: UseProductOptions = {}) {
  const queryClient = useQueryClient()
  const result = useApiQuery<Product>({
    queryKey: queryKeys.products.detail(id),
    queryFn: () => productsApi.get(id as string),
    fallbackError: 'Something went wrong. Please try again.',
    enabled: id != null,
    requireFresh,
  })
  const { data, setData } = result

  /**
   * Same contract as the `useState` setter it replaces. A product set here — the answer to a
   * stock movement, an activation — is also written into any cached Inventory page, so the list
   * is already right when the user goes back to it.
   */
  const setProduct = useCallback(
    (action: SetStateAction<Product | null>) => {
      const next = typeof action === 'function' ? action(data ?? null) : action
      if (next == null) return
      setData(next)
      syncProductIntoCache(queryClient, next)
    },
    [data, setData, queryClient],
  )

  return {
    product: data ?? null,
    setProduct,
    loading: result.loading,
    error: result.error,
    showingSaved: result.showingSaved,
    updatedAt: result.updatedAt,
    refetch: result.refetch,
  }
}
