import { useEffect, useState } from 'react'
import { storefrontApi } from '@/features/storefront/api/storefrontApi'
import type { MarketplaceSettings } from '@/features/storefront/types'

/**
 * Fallbacks mirroring the defaults seeded by `marketplace_settings` in V6 (contract §4.10). The
 * storefront footer shows a support contact on the very first paint and on every deploy where the
 * settings endpoint is unavailable — a store with no visible way to reach a human reads as broken,
 * so a stale-but-correct default beats an empty slot.
 */
export const MARKETPLACE_SETTINGS_FALLBACK: MarketplaceSettings = {
  deliveryFee: 2500,
  freeDeliveryThreshold: 150000,
  minimumOrderValue: 0,
  payOnDeliveryEnabled: true,
  supportPhone: null,
  supportEmail: 'support@procurepal.ng',
}

export function useMarketplaceSettings() {
  const [settings, setSettings] = useState<MarketplaceSettings>(MARKETPLACE_SETTINGS_FALLBACK)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    storefrontApi
      .settings()
      .then((data) => {
        // Merge rather than replace: a partial payload must not blank out the support contact.
        if (!cancelled && data) setSettings({ ...MARKETPLACE_SETTINGS_FALLBACK, ...data })
      })
      .catch(() => {
        // Silent: the fallback above is already a usable answer.
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { settings, loading }
}
