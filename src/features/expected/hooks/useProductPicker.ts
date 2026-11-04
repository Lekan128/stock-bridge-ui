import { useApiQuery } from '@/data/useApiQuery'
import { expectedCopy } from '@/features/expected/copy'
import { importsApi } from '@/features/imports/api/importsApi'
import type { DeliveryLine } from '@/features/imports/types'

/**
 * Products matching what was typed, a handful at a time. The server caps the answer, so this is the
 * same few rows at thirty products and at thirty thousand — which is the whole point: the form never
 * loads "everything" and asks the person to scroll it.
 *
 * Kept off the device (`persist: false`): a search is a question about right now, not data worth
 * restoring after a restart.
 */
/** How many products a search shows. Few on purpose: the answer to "too many" is to type more, not to scroll. */
export const PICKER_LIMIT = 8

export function useProductSearch(text: string) {
  const query = text.trim()
  const result = useApiQuery<DeliveryLine[]>({
    queryKey: ['imports', 'picker', 'search', query],
    queryFn: () => importsApi.deliveryLines({ search: query, limit: PICKER_LIMIT }),
    fallbackError: expectedCopy.picker.failed,
    enabled: query.length > 0,
    keepPrevious: true,
    persist: false,
  })
  return { lines: query.length > 0 ? (result.data ?? null) : null, loading: result.loading && query.length > 0, error: result.error, refetch: result.refetch }
}

/** A few of this supplier's own products — what is usually asked of them — to start from. */
export function useUsualProducts(vendorId: string) {
  const result = useApiQuery<DeliveryLine[]>({
    queryKey: ['imports', 'picker', 'usual', vendorId],
    queryFn: () => importsApi.deliveryLines({ vendorId, limit: 6 }),
    fallbackError: expectedCopy.picker.failed,
    enabled: vendorId !== '',
    persist: false,
  })
  return { lines: vendorId !== '' ? (result.data ?? null) : null, loading: result.loading && vendorId !== '' }
}
