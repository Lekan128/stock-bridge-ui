import { useEffect, useState } from 'react'
import { superAdminApiClient } from '@/features/admin/api/superAdminApi'
import type { ClientListParams, SuperAdminClientSummary } from '@/features/admin/types'
import type { PageResponse } from '@/features/products/types'
import { isAppError } from '@/types/api'

export function useClients(params: ClientListParams) {
  const [data, setData] = useState<PageResponse<SuperAdminClientSummary> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const paramsKey = JSON.stringify(params)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    superAdminApiClient
      .listClients(params)
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
  }, [paramsKey, reloadToken])

  return { data, loading, error, refetch: () => setReloadToken((t) => t + 1) }
}
