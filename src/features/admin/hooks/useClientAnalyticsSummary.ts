import { useEffect, useState } from 'react'
import type { AnalyticsDateRangeParams, AnalyticsSummary } from '@/components/analytics/types'
import { superAdminApiClient } from '@/features/admin/api/superAdminApi'
import { isAppError } from '@/types/api'

/**
 * `version` is a caller-bumped counter that forces a refetch when the underlying data changed
 * without the id or the date range changing — the catalog reset is the only thing that does
 * that today. Without it the stat cards keep showing the stock of a tenant that no longer has
 * any, directly beside a product count that has already updated.
 */
export function useClientAnalyticsSummary(
  id: string | undefined,
  params: AnalyticsDateRangeParams,
  version = 0,
) {
  const [data, setData] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const paramsKey = JSON.stringify(params)

  useEffect(() => {
    if (!id) return

    let cancelled = false
    setLoading(true)
    setError(null)

    superAdminApiClient
      .clientAnalyticsSummary(id, params)
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
  }, [id, paramsKey, version])

  return { data, loading, error }
}
