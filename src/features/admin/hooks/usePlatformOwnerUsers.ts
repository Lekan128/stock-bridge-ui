import { useEffect, useState } from 'react'
import { superAdminApiClient } from '@/features/admin/api/superAdminApi'
import type { AdminUserListParams, SuperAdminUserSummary } from '@/features/admin/types'
import type { PageResponse } from '@/features/products/types'
import { isAppError } from '@/types/api'

/**
 * ProcurePal's own users (GET /api/superadmin/platform-owner/users).
 *
 * Reports `notBootstrapped` separately from `error`. On a read there is exactly one thing a 409
 * can mean here — no client has `is_platform_owner = TRUE`, so there is no ProcurePal tenant to
 * list users for — and that is a configuration step nobody has done yet on a fresh deployment,
 * not a failure. The page renders it as a setup state, and the server's own sentence (which
 * names the `app.platform-owner.*` config to set) is carried through as `notBootstrappedMessage`
 * rather than being replaced with our own guess at the remedy.
 */
export function usePlatformOwnerUsers(params: AdminUserListParams) {
  const [data, setData] = useState<PageResponse<SuperAdminUserSummary> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notBootstrappedMessage, setNotBootstrappedMessage] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const paramsKey = JSON.stringify(params)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setNotBootstrappedMessage(null)

    superAdminApiClient
      .listPlatformOwnerUsers(params)
      .then((response) => {
        if (!cancelled) setData(response)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (isAppError(err) && err.status === 409) {
          setNotBootstrappedMessage(err.message)
          setData(null)
          return
        }
        setError(isAppError(err) ? err.message : 'Something went wrong. Please try again.')
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

  return {
    data,
    loading,
    error,
    notBootstrapped: notBootstrappedMessage !== null,
    notBootstrappedMessage,
    refetch: () => setReloadToken((t) => t + 1),
  }
}
