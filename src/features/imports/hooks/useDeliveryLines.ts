import { useApiQuery } from '@/data/useApiQuery'
import { importsApi } from '@/features/imports/api/importsApi'
import { copy } from '@/features/imports/copy'
import type { DeliveryLine, StockInFilter } from '@/features/imports/types'

/**
 * The products and packs Record a delivery offers a quantity box for. Cached like the inventory
 * reads (A2) since A5: a delivery is recorded at the gate, often in a dead spot, and a draft is
 * only any use if the page can show what to type against without the server.
 */
export function useDeliveryLines(filter: StockInFilter, vendorId?: string) {
  const result = useApiQuery<DeliveryLine[]>({
    queryKey: ['imports', 'delivery-lines', filter, vendorId ?? null],
    queryFn: () => importsApi.deliveryLines({ filter, vendorId }),
    fallbackError: copy.delivery.loadFailed,
    keepPrevious: true,
  })
  return { lines: result.data ?? null, loading: result.loading, error: result.error, refetch: result.refetch }
}
