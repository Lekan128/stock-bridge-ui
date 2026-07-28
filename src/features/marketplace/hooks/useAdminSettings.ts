import { useCallback, useEffect, useState } from 'react'
import { marketplaceAdminApi } from '@/features/marketplace/api/marketplaceAdminApi'
import type { AdminMarketplaceSettings } from '@/features/marketplace/types'
import { isAppError } from '@/types/api'

/**
 * The live commercial rules — delivery fee, thresholds, pay-on-delivery policy, support contact.
 *
 * `setSettings` is exposed so the settings form can seed itself from the PUT response (a full
 * replacement returns the canonical row, including the new `updatedAt`) instead of refetching and
 * briefly re-rendering the form from stale values.
 */
export function useAdminSettings() {
  const [settings, setSettings] = useState<AdminMarketplaceSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    marketplaceAdminApi
      .settings()
      .then((data) => {
        if (!cancelled) setSettings(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setSettings(null)
          setError(isAppError(err) ? err.message : 'Could not load marketplace settings. Please try again.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])

  return { settings, setSettings, loading, error, refetch }
}
