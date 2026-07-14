import { useEffect, useState } from 'react'
import { analyticsApi } from '@/features/analytics/api/analyticsApi'
import type { AnalyticsDateRangeParams, TopProductEntry, TopProductsDirection, TopProductsMetric } from '@/components/analytics/types'
import { isAppError } from '@/types/api'

export function useTopProducts(
  params: AnalyticsDateRangeParams & { by: TopProductsMetric; direction: TopProductsDirection; limit?: number },
) {
  const [data, setData] = useState<TopProductEntry[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const paramsKey = JSON.stringify(params)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    analyticsApi
      .topProducts(params)
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
  }, [paramsKey])

  return { data, loading, error }
}
