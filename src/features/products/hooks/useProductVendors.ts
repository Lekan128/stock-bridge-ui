import { useCallback, type SetStateAction } from 'react'
import { queryKeys } from '@/data/queryKeys'
import { useApiQuery } from '@/data/useApiQuery'
import { productVendorsApi } from '@/features/products/api/productVendorsApi'
import type { ProductVendor } from '@/features/products/vendors/types'

const NO_VENDORS: ProductVendor[] = []

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
  const result = useApiQuery<ProductVendor[]>({
    queryKey: queryKeys.products.vendors(productId),
    queryFn: () => productVendorsApi.list(productId as string),
    fallbackError: 'Could not load suppliers for this product.',
    enabled: productId != null,
  })
  const data = result.data ?? NO_VENDORS
  const { setData: setCached } = result

  // Same contract as the `useState` setter it replaces, including the updater form the tab uses
  // for its optimistic preferred-vendor swap.
  const setData = useCallback(
    (action: SetStateAction<ProductVendor[]>) => {
      setCached((current) => (typeof action === 'function' ? action(current ?? NO_VENDORS) : action))
    },
    [setCached],
  )

  return { data, setData, loading: result.loading, error: result.error, refetch: result.refetch }
}
