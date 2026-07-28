import { useCallback, useEffect, useState } from 'react'
import { marketplaceAdminApi } from '@/features/marketplace/api/marketplaceAdminApi'
import type { AdminCategory } from '@/features/marketplace/types'
import { isAppError } from '@/types/api'

/**
 * Every category, listed and unlisted. Unlike the storefront's `useCategories` this one does
 * surface its error: on the catalog admin screen the category list *is* the content, and silently
 * showing "no categories" to someone who is about to create a duplicate would be worse than a
 * visible failure.
 *
 * The list is small and global (one level of nesting, six rows in production today), so it is
 * fetched whole rather than paged.
 */
export function useAdminCategories() {
  const [categories, setCategories] = useState<AdminCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    marketplaceAdminApi
      .categories()
      .then((data) => {
        if (!cancelled) setCategories(Array.isArray(data) ? data : [])
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCategories([])
          setError(isAppError(err) ? err.message : 'Could not load categories. Please try again.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])

  return { categories, loading, error, refetch }
}
