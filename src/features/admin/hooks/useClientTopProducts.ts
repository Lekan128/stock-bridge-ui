import { useEffect, useState } from 'react'
import type { AnalyticsDateRangeParams, TopProductEntry, TopProductsDirection, TopProductsMetric } from '@/components/analytics/types'
import { superAdminApiClient } from '@/features/admin/api/superAdminApi'
import { isAppError } from '@/types/api'

export function useClientTopProducts(
  id: string | undefined,
  params: AnalyticsDateRangeParams & { by: TopProductsMetric; direction: TopProductsDirection; limit?: number },
) {
  const [data, setData] = useState<TopProductEntry[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const paramsKey = JSON.stringify(params)

  useEffect(() => {
    if (!id) return

    let cancelled = false
    setLoading(true)
    setError(null)

    superAdminApiClient
      .clientTopProducts(id, params)
      .then((response) => {
        if (!cancelled) setData(response)
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
    // paramsKey is a stable stand-in for params (a fresh object each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, paramsKey])

  return { data, loading, error }
}
