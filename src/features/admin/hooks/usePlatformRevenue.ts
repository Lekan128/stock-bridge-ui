import { useCallback, useEffect, useState } from 'react'
import { superAdminApiClient } from '@/features/admin/api/superAdminApi'
import type {
  PlatformRevenueParams,
  PlatformRevenuePoint,
  PlatformRevenueSummary,
  SellerRevenueBreakdown,
  SellerRevenueSort,
} from '@/features/admin/types'
import { isAppError } from '@/types/api'

/**
 * The three cross-seller revenue reads, as three independent hooks.
 *
 * <h2>Why three and not one</h2>
 * The screen's controls move independently: changing the bucket size must not re-fetch the
 * seller table, and re-sorting the table must not redraw the chart. One combined hook would
 * make every control a full-page reload, and one failing request would blank the other two
 * panels. This is the same arrangement the marketplace analytics screen uses, arrived at for
 * the same reason.
 *
 * <h2>Why loaded data survives a refetch</h2>
 * `data` is not cleared when a new request starts. Moving the date range therefore dims the
 * existing numbers rather than replacing them with skeletons, which is what stops the page
 * strobing as an operator scrubs through months. The page reads `loading && data != null` to
 * decide that.
 *
 * <p>Hand-rolled rather than a query library, matching every other hook in this feature —
 * `usePlatformAggregate` is the one to compare against. `paramsKey` is a stable stand-in for
 * the params object, which is a fresh literal on every render.
 */
function useSuperAdminResource<P, T>(fetcher: (params: P) => Promise<T>, params: P) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const paramsKey = JSON.stringify(params)

  const refetch = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetcher(params)
      .then((response) => {
        if (!cancelled) setData(response)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(isAppError(err) ? err.message : 'We could not load these figures.')
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

  return { data, loading, error, refetch }
}

export function usePlatformRevenueSummary(params: PlatformRevenueParams) {
  return useSuperAdminResource<PlatformRevenueParams, PlatformRevenueSummary>(
    superAdminApiClient.platformRevenueSummary,
    params,
  )
}

export function usePlatformRevenueOverTime(
  params: PlatformRevenueParams & { granularity: 'DAY' | 'WEEK' | 'MONTH' },
) {
  return useSuperAdminResource<typeof params, PlatformRevenuePoint[]>(
    superAdminApiClient.platformRevenueOverTime,
    params,
  )
}

export function useSellerRevenueBreakdown(
  params: PlatformRevenueParams & { sort?: SellerRevenueSort; ascending?: boolean },
) {
  return useSuperAdminResource<typeof params, SellerRevenueBreakdown>(
    superAdminApiClient.platformRevenueBySeller,
    params,
  )
}
