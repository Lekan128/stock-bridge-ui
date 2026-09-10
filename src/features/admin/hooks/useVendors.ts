import { useCallback, useEffect, useState } from 'react'
import { superAdminApiClient } from '@/features/admin/api/superAdminApi'
import type { SuperAdminVendorSummary, VendorListParams } from '@/features/admin/types'
import type { PageResponse } from '@/features/products/types'
import { isAppError } from '@/types/api'

/**
 * Marketplace vendor accounts. Same hand-rolled shape as `useClients`, over a narrower set: the
 * server resolves this list by `client_type = VENDOR`, so ProcurePal — which sells but is a
 * COMPANY — is deliberately absent and is managed through the Tenants screen like the tenant it is.
 */
export function useVendors(params: VendorListParams) {
  const [data, setData] = useState<PageResponse<SuperAdminVendorSummary> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const paramsKey = JSON.stringify(params)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    superAdminApiClient
      .listVendors(params)
      .then((page) => {
        if (!cancelled) setData(page)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(isAppError(err) ? err.message : 'We could not load vendors.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, reloadToken])

  const refetch = useCallback(() => setReloadToken((token) => token + 1), [])

  return { data, vendors: data?.content ?? [], loading, error, refetch }
}
