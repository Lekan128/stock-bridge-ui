import { useEffect, useState } from 'react'
import type { AnalyticsDateRangeParams } from '@/components/analytics/types'
import { superAdminApiClient } from '@/features/admin/api/superAdminApi'
import type { PlatformAggregateResponse } from '@/features/admin/types'
import { isAppError } from '@/types/api'

export function usePlatformAggregate(params: AnalyticsDateRangeParams) {
  const [data, setData] = useState<PlatformAggregateResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const paramsKey = JSON.stringify(params)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    superAdminApiClient
      .aggregate(params)
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
