import { useCallback } from 'react'
import { queryKeys } from '@/data/queryKeys'
import { useApiQuery } from '@/data/useApiQuery'
import { companyCategoriesApi } from '@/features/products/categories/api'
import type { CompanyCategory } from '@/features/products/categories/types'

const NO_CATEGORIES: CompanyCategory[] = []

function byName(a: CompanyCategory, b: CompanyCategory): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}

/**
 * The company's categories, for a filter, a picker, or the manage dialog.
 *
 * Fetched whole rather than paged: a company groups its products into tens of categories, not
 * thousands, and every caller is a `<select>` or a short list where paging would hide the one
 * being looked for.
 *
 * `enabled` is false for a caller without VIEW_PRODUCTS, so nobody's network tab fills with 403s
 * for a list they were never going to see.
 *
 * `upsert` and `remove` apply a write the caller has just made, so a created category can be
 * selected straight away without waiting on a second fetch. `reload` is for when the counts
 * matter — they are the server's, and only it knows how many products a change touched.
 */
export function useCompanyCategories(enabled: boolean) {
  const result = useApiQuery<CompanyCategory[]>({
    queryKey: queryKeys.categories,
    queryFn: () => companyCategoriesApi.list(),
    fallbackError: 'We could not load your categories.',
    enabled,
  })
  const { setData, refetch } = result

  // Applied to the shared cache entry, so a category created in the product form's inline picker
  // shows up in the Inventory filter too without a refetch.
  const upsert = useCallback(
    (category: CompanyCategory) => {
      setData((current) => [...(current ?? []).filter((entry) => entry.id !== category.id), category].sort(byName))
    },
    [setData],
  )

  const remove = useCallback(
    (id: string) => {
      setData((current) => (current ?? []).filter((entry) => entry.id !== id))
    },
    [setData],
  )

  return {
    categories: enabled ? (result.data ?? NO_CATEGORIES) : NO_CATEGORIES,
    loading: result.loading,
    error: result.error,
    reload: refetch,
    upsert,
    remove,
  }
}
