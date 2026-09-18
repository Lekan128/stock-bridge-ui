import { useCallback, useEffect, useState } from 'react'
import { productDataIssuesApi, type ProductDataIssue } from '@/features/products/quality/api'
import { isAppError } from '@/types/api'

/**
 * Fetched on every mount, deliberately uncached: the list shrinks as the owner fixes things, and
 * coming back to the product list should show the new count rather than a stale one.
 */
export function useProductDataIssues() {
  const [issues, setIssues] = useState<ProductDataIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    productDataIssuesApi
      .list()
      .then((response) => {
        if (!cancelled) setIssues(response)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(isAppError(err) ? err.message : 'Something went wrong. Please try again.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const refetch = useCallback(() => setReloadKey((key) => key + 1), [])

  return { issues, setIssues, loading, error, refetch }
}
