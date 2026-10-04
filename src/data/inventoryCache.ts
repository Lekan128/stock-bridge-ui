import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/data/queryKeys'
import type { PageResponse, Product } from '@/features/products/types'

/**
 * Writes a product the server just returned into every cached place that shows it: its detail
 * entry and any cached page of the Inventory list it appears on.
 *
 * Every screen still revalidates when it opens, so this is not about correctness eventually —
 * it is about the moment after. Without it, recording a stock-in and going Back showed the list's
 * cached quantity, the old one, until the refetch landed. With it the list is already right.
 */
export function syncProductIntoCache(queryClient: QueryClient, product: Product): void {
  queryClient.setQueryData<Product>(queryKeys.products.detail(product.id), product)
  queryClient.setQueriesData<PageResponse<Product>>({ queryKey: ['products', 'list'] }, (page) =>
    page == null
      ? page
      : {
          ...page,
          content: page.content.map((entry) => (entry.id === product.id ? { ...entry, ...product } : entry)),
        },
  )
}

/**
 * After a write whose effects reach further than one product (an import, a delivery, a product
 * created or edited): mark everything stock-related stale and refresh whatever is on screen now.
 */
export function invalidateInventory(queryClient: QueryClient): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.stockMovements.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.expected.all }),
  ]).then(() => undefined)
}
