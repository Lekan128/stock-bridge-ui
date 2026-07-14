import { useEffect, useState } from 'react'
import type { AnalyticsDateRangeParams, Granularity, MovementsOverTimePoint } from '@/components/analytics/types'
import { superAdminApiClient } from '@/features/admin/api/superAdminApi'
import { isAppError } from '@/types/api'

export function useClientMovementsOverTime(
  id: string | undefined,
  params: AnalyticsDateRangeParams & { granularity: Granularity },
) {
  const [data, setData] = useState<MovementsOverTimePoint[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const paramsKey = JSON.stringify(params)

  useEffect(() => {
    if (!id) return

    let cancelled = false
    setLoading(true)
    setError(null)

    superAdminApiClient
      .clientMovementsOverTime(id, params)
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
