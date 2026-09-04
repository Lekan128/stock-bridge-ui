import { useEffect, useState } from 'react'
import { productsApi } from '@/features/products/api/productsApi'
import type { ProductSkuSettings } from '@/features/products/types'
import { isAppError } from '@/types/api'

/** The tenant's automatic SKU generation settings (GET /api/products/sku-settings) — same shape as useCompany. */
export function useProductSkuSettings() {
  const [settings, setSettings] = useState<ProductSkuSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    productsApi
      .getSkuSettings()
      .then((response) => {
        if (!cancelled) setSettings(response)
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
  }, [reloadToken])

  return { settings, setSettings, loading, error, refetch: () => setReloadToken((t) => t + 1) }
}
