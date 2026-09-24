import { useCallback, useEffect, useState } from 'react'
import { companyCategoriesApi } from '@/features/products/categories/api'
import type { CompanyCategory } from '@/features/products/categories/types'
import { isAppError } from '@/types/api'

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
  const [categories, setCategories] = useState<CompanyCategory[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setCategories([])
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)

    companyCategoriesApi
      .list()
      .then((response) => {
        if (!cancelled) setCategories(response)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(isAppError(err) ? err.message : 'We could not load your categories.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [enabled, reloadToken])

  const upsert = useCallback((category: CompanyCategory) => {
    setCategories((current) =>
      [...current.filter((entry) => entry.id !== category.id), category].sort(byName),
    )
  }, [])

  const remove = useCallback((id: string) => {
    setCategories((current) => current.filter((entry) => entry.id !== id))
  }, [])

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  return { categories, loading, error, reload, upsert, remove }
}
