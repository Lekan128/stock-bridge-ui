import { useCallback, useEffect, useState } from 'react'
import type { DeliveryAddress } from '@/features/addresses/types'
import { vendorPickupAddressesApi } from '@/features/vendor/api/vendorPickupAddressesApi'
import { isAppError } from '@/types/api'

/**
 * The seller's pickup points. A plain array, sorted default-first then alphabetically — the
 * server returns its own order and the default is the one people look for, so it leads.
 *
 * A near-twin of `useAddresses`, and deliberately a separate hook rather than a parameter on
 * it: the two read different endpoints, and a shared hook taking a "which kind" argument would
 * be one boolean away from a buyer's checkout picker fetching pickup depots.
 */
export function usePickupAddresses() {
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    vendorPickupAddressesApi
      .list()
      .then((data) => {
        if (cancelled) return
        setAddresses(
          [...data].sort((a, b) => {
            if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
            return a.label.localeCompare(b.label)
          }),
        )
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(isAppError(err) ? err.message : 'Could not load your pickup addresses.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])

  return { addresses, setAddresses, loading, error, refetch }
}
