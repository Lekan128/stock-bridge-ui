import { useCallback, useEffect, useState } from 'react'
import { vendorsApi } from '@/features/vendors/api/vendorsApi'
import type { CompanyVendorDetail } from '@/features/vendors/types'
import { isAppError } from '@/types/api'

/**
 * One vendor's detail: the row, the live seller behind it, spend to date and the products supplied
 * with their last purchase price — one request, because they are one screen.
 *
 * Purchase history is deliberately not in here. It is paginated and it is its own screen.
 */
export function useVendor(id: string | undefined) {
  const [detail, setDetail] = useState<CompanyVendorDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setError(null)

    vendorsApi
      .get(id)
      .then((response) => {
        if (!cancelled) setDetail(response)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(isAppError(err) ? err.message : 'Could not load this vendor.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id, reloadToken])

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])

  return { detail, loading, error, refetch }
}
