import { useCallback, useEffect, useState } from 'react'
import { addressesApi } from '@/features/addresses/api/addressesApi'
import type { DeliveryAddress } from '@/features/addresses/types'
import { isAppError } from '@/types/api'

/**
 * The company's address book. A plain array, sorted default-first then alphabetically — the
 * server returns its own order and the default is the one people look for, so it leads.
 */
export function useAddresses() {
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    addressesApi
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
        if (!cancelled) setError(isAppError(err) ? err.message : 'Could not load your delivery addresses.')
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
