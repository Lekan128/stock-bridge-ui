import { useCallback, useEffect, useState } from 'react'
import { checkoutApi } from '@/features/checkout/api/checkoutApi'
import type { DeliveryAddress } from '@/features/checkout/types'
import { isAppError } from '@/types/api'

/**
 * The company's saved delivery addresses, for the checkout picker.
 *
 * Inactive addresses are filtered out here rather than at the call site: a deactivated location is
 * kept server-side so past orders still resolve their `addressId`, but offering it as a delivery
 * option would let a buyer ship to somewhere the company has retired.
 */
export function useDeliveryAddresses() {
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    checkoutApi
      .addresses()
      .then((data) => {
        if (cancelled) return
        const usable = (Array.isArray(data) ? data : []).filter((address) => address.active !== false)
        // Default first, then alphabetical — the picker preselects the default, and a list whose
        // first row is not the preselected one reads as a bug.
        usable.sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.label.localeCompare(b.label))
        setAddresses(usable)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(isAppError(err) ? err.message : 'We could not load your delivery addresses.')
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

  /** Adds a just-created address without a round trip, keeping the default-first ordering. */
  const addLocal = useCallback((address: DeliveryAddress) => {
    setAddresses((current) => {
      const others = address.isDefault ? current.map((item) => ({ ...item, isDefault: false })) : current
      return [...others, address].sort(
        (a, b) => Number(b.isDefault) - Number(a.isDefault) || a.label.localeCompare(b.label),
      )
    })
  }, [])

  return { addresses, loading, error, refetch, addLocal }
}
