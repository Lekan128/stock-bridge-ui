import { useCallback, useEffect, useRef, useState } from 'react'
import { checkoutApi } from '@/features/checkout/api/checkoutApi'
import type { CheckoutQuote } from '@/features/checkout/types'
import { isAppError } from '@/types/api'

/**
 * What the current cart costs, re-priced whenever the delivery address changes.
 *
 * The address is an input to the price, not a display detail — delivery fees and pay-on-delivery
 * eligibility both depend on it — so every address change has to re-quote rather than reuse the
 * total already on screen.
 *
 * `refreshing` is separate from `loading`: the first quote shows skeletons, a re-quote dims the
 * numbers already there. Replacing a visible total with a spinner mid-checkout reads as the price
 * having been thrown away.
 */
export function useCheckoutQuote(deliveryAddressId: string | undefined) {
  const [quote, setQuote] = useState<CheckoutQuote | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  // Mirrors `quote !== null` so the effect can branch on it without taking `quote` as a
  // dependency — which would re-fire the request on every response.
  const hasQuote = useRef(false)

  useEffect(() => {
    let cancelled = false
    setError(null)
    if (hasQuote.current) setRefreshing(true)
    else setLoading(true)

    checkoutApi
      .quote(deliveryAddressId)
      .then((data) => {
        if (!cancelled) {
          hasQuote.current = true
          setQuote(data)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(isAppError(err) ? err.message : 'We could not price your order. Please try again.')
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          setRefreshing(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [deliveryAddressId, reloadToken])

  const refetch = useCallback(() => setReloadToken((token) => token + 1), [])

  return { quote, loading, refreshing, error, refetch }
}
