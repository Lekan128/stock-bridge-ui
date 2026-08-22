import { useCallback, useEffect, useState } from 'react'
import { superAdminApiClient } from '@/features/admin/api/superAdminApi'
import type { VendorApplication, VendorWaitlistCounts, VendorWaitlistParams } from '@/features/admin/types'
import type { PageResponse } from '@/features/products/types'
import { isAppError } from '@/types/api'

/**
 * The vendor waitlist queue, plus the tab counts.
 *
 * Hand-rolled like every other data hook here (contract §8: no react-query), and modelled on
 * `useModerationQueue`, which solves the identical problem one screen over.
 *
 * The counts are refetched alongside the page rather than cached, for that hook's reason: a
 * decision changes both. Approving an application moves it out of the pending queue AND
 * decrements the badge, and a badge that disagreed with the list in front of the reviewer would
 * make them doubt the queue rather than the badge.
 */
export function useVendorWaitlist(params: VendorWaitlistParams) {
  const [data, setData] = useState<PageResponse<VendorApplication> | null>(null)
  const [counts, setCounts] = useState<VendorWaitlistCounts | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const paramsKey = JSON.stringify(params)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([superAdminApiClient.vendorApplications(params), superAdminApiClient.vendorWaitlistCounts()])
      .then(([page, nextCounts]) => {
        if (!cancelled) {
          setData(page)
          setCounts(nextCounts)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(isAppError(err) ? err.message : 'We could not load the vendor waitlist.')
          // Deliberately not clearing `data`: an error banner over the last good page beats a
          // blank screen, and the retry button re-runs this effect.
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // paramsKey is a stable stand-in for params (a fresh object every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, reloadToken])

  const refetch = useCallback(() => setReloadToken((token) => token + 1), [])

  return {
    data,
    applications: data?.content ?? [],
    counts,
    loading,
    error,
    refetch,
  }
}
