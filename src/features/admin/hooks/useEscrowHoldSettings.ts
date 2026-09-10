import { useCallback, useEffect, useState } from 'react'
import { superAdminApiClient } from '@/features/admin/api/superAdminApi'
import type { EscrowHoldSettings } from '@/features/admin/types'
import { isAppError } from '@/types/api'

/**
 * The escrow hold and its change history.
 *
 * Same hand-rolled shape as `useVendors` and `useClients` — this codebase has no data-fetching
 * library and adding one for a single settings screen would be a dependency for a `useEffect`.
 *
 * `setData` is exposed alongside `refetch`, deliberately. The change endpoint returns the
 * settings AS THEY NOW STAND, including the new audit row, so the page can render the result of
 * a change directly instead of firing a second request whose answer it already has. Refetching
 * instead would leave a visible flicker on the one screen where an operator most wants to see
 * that the thing they just did actually landed.
 */
export function useEscrowHoldSettings() {
  const [data, setData] = useState<EscrowHoldSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    superAdminApiClient
      .getEscrowHoldSettings()
      .then((settings) => {
        if (!cancelled) setData(settings)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(isAppError(err) ? err.message : 'We could not load the settlement settings.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const refetch = useCallback(() => setReloadToken((token) => token + 1), [])

  return { data, loading, error, refetch, setData }
}
