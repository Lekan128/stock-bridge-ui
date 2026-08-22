import { useEffect, useState } from 'react'
import { storefrontApi } from '@/features/storefront/api/storefrontApi'
import type { MarketplaceSeller } from '@/features/storefront/types'
import { isAppError } from '@/types/api'

/**
 * One seller's public profile, by id or slug. Follows the hand-rolled hook pattern used
 * throughout this codebase (contract §8: no react-query).
 *
 * A 404 here is an ordinary outcome, not an exception to shout about: the id might name a buying
 * company, a deactivated vendor, or a seller with nothing listed yet. The API collapses all of
 * those into one "not available" deliberately — distinguishing them would turn a public endpoint
 * into a way to confirm which companies use ProcurePaddy — so the caller renders a plain
 * not-found state rather than trying to explain which case it was.
 */
export function useSeller(idOrSlug: string | undefined) {
  const [seller, setSeller] = useState<MarketplaceSeller | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!idOrSlug) {
      setSeller(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)

    storefrontApi
      .seller(idOrSlug)
      .then((response) => {
        if (!cancelled) setSeller(response)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setSeller(null)
          setError(isAppError(err) ? err.message : 'We could not load this seller.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [idOrSlug])

  return { seller, loading, error }
}

/**
 * Every seller a buyer can currently buy from, for the "Sold by" filter.
 *
 * Failure degrades to an empty list rather than an error: the filter is an optional refinement on
 * a catalog that renders perfectly well without it, and breaking the whole storefront because one
 * secondary request failed would be the wrong trade.
 */
export function useSellers() {
  const [sellers, setSellers] = useState<MarketplaceSeller[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    storefrontApi
      .sellers()
      .then((response) => {
        if (!cancelled) setSellers(response ?? [])
      })
      .catch(() => {
        if (!cancelled) setSellers([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { sellers, loading }
}
