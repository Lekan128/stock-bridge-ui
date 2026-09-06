import { useCallback, useEffect, useState } from 'react'
import type { PageResponse } from '@/features/products/types'
import { purchasesApi } from '@/features/purchases/api/purchasesApi'
import type { PurchaseHistoryEntry, PurchaseHistoryParams } from '@/features/purchases/types'
import { isAppError } from '@/types/api'

/**
 * Backs both purchase-history screens. Pass `companyVendorId` for the per-vendor one; omit it for
 * the company-wide feed. `params` is taken whole (not individual fields) so a caller's filter
 * state — source, date range — flows straight through without this hook re-declaring each one.
 */
export function usePurchaseHistory(params: PurchaseHistoryParams) {
  const [data, setData] = useState<PageResponse<PurchaseHistoryEntry> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const { companyVendorId, source, from, to, page, size } = params

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    purchasesApi
      .search({ companyVendorId, source, from, to, page, size })
      .then((response) => {
        if (!cancelled) setData(response)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(isAppError(err) ? err.message : 'Could not load purchase history.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [companyVendorId, source, from, to, page, size, reloadToken])

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])

  return { data, loading, error, refetch }
}
