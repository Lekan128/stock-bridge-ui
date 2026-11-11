import { useApiQuery } from '@/data/useApiQuery'
import { expectedApi } from '@/features/expected/api/expectedApi'
import { expectedCopy } from '@/features/expected/copy'
import type { PickerLine, RecentSupplier } from '@/features/expected/types'

/**
 * The new purchase order's lookups. Each is a question about right now (stock left, what is coming),
 * so none is kept on the device (`persist: false`), and each is bounded by the server: the form
 * never loads "everything" and asks the person to scroll it.
 */

/** How many products a search shows. Few on purpose: the answer to "too many" is to type more. */
export const PICKER_LIMIT = 8

/** Products matching what was typed, each with stock left at `branchId` and last time from this supplier. */
export function useProductSearch(text: string, vendorId: string, branchId: string, excludeOrderId = '') {
  const query = text.trim()
  const result = useApiQuery<PickerLine[]>({
    queryKey: ['expected', 'picker', 'search', query, vendorId, branchId, excludeOrderId],
    queryFn: () => expectedApi.picker({ search: query, vendorId, branchId, limit: PICKER_LIMIT, excludeOrderId }),
    fallbackError: expectedCopy.form.searchFailed,
    enabled: query.length > 0,
    keepPrevious: true,
    persist: false,
  })
  return {
    lines: query.length > 0 ? (result.data ?? null) : null,
    loading: result.loading && query.length > 0,
    error: result.error,
  }
}

/**
 * What to start from once a supplier is picked: their products that are low or out here, or — when
 * nothing is low — a few of what is usually bought from them.
 */
export function useSuggestions(vendorId: string, branchId: string, excludeOrderId = '') {
  const low = useApiQuery<PickerLine[]>({
    queryKey: ['expected', 'picker', 'low', vendorId, branchId, excludeOrderId],
    queryFn: () => expectedApi.picker({ vendorId, branchId, runningLow: true, excludeOrderId }),
    fallbackError: expectedCopy.form.searchFailed,
    enabled: vendorId !== '',
    persist: false,
  })
  const nothingLow = low.data != null && low.data.length === 0
  const usual = useApiQuery<PickerLine[]>({
    queryKey: ['expected', 'picker', 'usual', vendorId, branchId, excludeOrderId],
    queryFn: () => expectedApi.picker({ vendorId, branchId, limit: 6, excludeOrderId }),
    fallbackError: expectedCopy.form.searchFailed,
    enabled: vendorId !== '' && nothingLow,
    persist: false,
  })
  if (vendorId === '') return { kind: 'none' as const, lines: [] as PickerLine[] }
  if (low.data && low.data.length > 0) return { kind: 'low' as const, lines: low.data }
  return { kind: 'usual' as const, lines: usual.data ?? [] }
}

/** These products exactly, for "Order more" and "Order again". */
export function useProductsById(productIds: string[], vendorId: string, branchId: string, excludeOrderId = '') {
  const key = [...productIds].sort().join(',')
  const result = useApiQuery<PickerLine[]>({
    queryKey: ['expected', 'picker', 'ids', key, vendorId, branchId, excludeOrderId],
    queryFn: () => expectedApi.picker({ productIds, vendorId, branchId, excludeOrderId }),
    fallbackError: expectedCopy.form.searchFailed,
    enabled: productIds.length > 0,
    persist: false,
  })
  return { lines: result.data ?? null, loading: result.loading && productIds.length > 0 }
}

/** Suppliers ordered from, newest first — the order the supplier search lists them in. */
export function useRecentSuppliers(enabled: boolean) {
  const result = useApiQuery<RecentSupplier[]>({
    queryKey: ['expected', 'recent-suppliers'],
    queryFn: () => expectedApi.recentSuppliers(),
    fallbackError: expectedCopy.form.searchFailed,
    enabled,
    persist: false,
  })
  return result.data ?? []
}
