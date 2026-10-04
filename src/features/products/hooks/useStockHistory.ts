import { queryKeys } from '@/data/queryKeys'
import { useApiQuery } from '@/data/useApiQuery'
import { stockApi } from '@/features/products/api/stockApi'
import type { PageResponse, StockMovement } from '@/features/products/types'

export function useStockHistory(
  productId: string | undefined,
  page: number,
  { requireFresh = false }: { requireFresh?: boolean } = {},
) {
  const result = useApiQuery<PageResponse<StockMovement>>({
    queryKey: queryKeys.products.history(productId, page),
    queryFn: () => stockApi.history(productId as string, page),
    fallbackError: 'Something went wrong. Please try again.',
    enabled: productId != null,
    keepPrevious: true,
    requireFresh,
  })

  return { data: result.data ?? null, loading: result.loading, error: result.error, refetch: result.refetch }
}
