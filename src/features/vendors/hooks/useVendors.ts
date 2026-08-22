import { useCallback, useEffect, useState } from 'react'
import type { PageResponse } from '@/features/products/types'
import { vendorsApi } from '@/features/vendors/api/vendorsApi'
import type { CompanyVendor, VendorListParams } from '@/features/vendors/types'
import { isAppError } from '@/types/api'

/**
 * The directory list. Paged rather than fetched whole (unlike the address book): a company with a
 * real supplier list has hundreds of these, and every marketplace seller they buy from adds one
 * automatically without anybody asking.
 */
export function useVendors(params: VendorListParams) {
  const [data, setData] = useState<PageResponse<CompanyVendor> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const paramsKey = JSON.stringify(params)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    vendorsApi
      .list(params)
      .then((response) => {
        if (!cancelled) setData(response)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(isAppError(err) ? err.message : 'Could not load your vendor directory.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // paramsKey is a stable stand-in for params (a fresh object each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, reloadToken])

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])

  return { data, loading, error, refetch }
}
