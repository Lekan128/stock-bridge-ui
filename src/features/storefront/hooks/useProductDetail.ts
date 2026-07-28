import { useEffect, useState } from 'react'
import { storefrontApi } from '@/features/storefront/api/storefrontApi'
import type { MarketplaceProduct } from '@/features/storefront/types'
import { isAppError } from '@/types/api'

const RELATED_LIMIT = 4

export interface ProductDetailState {
  product: MarketplaceProduct | null
  related: MarketplaceProduct[]
  loading: boolean
  error: string | null
  /** True when the endpoint answered 404 — a genuinely missing product, not a transport failure. */
  notFound: boolean
  refetch: () => void
}

/**
 * One catalog product plus its related items, addressed by id *or* slug (the endpoint accepts
 * either, and storefront links carry the slug while the cart carries the id).
 *
 * 404 is separated from every other failure because the two need opposite screens: a delisted
 * product is a dead end that should offer a way back into the catalog, while a network blip is a
 * retry. Related products fail silently — a missing carousel must never take the buy button with it.
 */
export function useProductDetail(idOrSlug: string | undefined): ProductDetailState {
  const [product, setProduct] = useState<MarketplaceProduct | null>(null)
  const [related, setRelated] = useState<MarketplaceProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!idOrSlug) {
      setLoading(false)
      setNotFound(true)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setNotFound(false)

    storefrontApi
      .product(idOrSlug)
      .then((data) => {
        if (cancelled) return
        setProduct(data)
        // Fired only once the product exists, and addressed by the same key the caller used.
        return storefrontApi
          .related(idOrSlug, RELATED_LIMIT)
          .then((items) => {
            if (!cancelled) setRelated(Array.isArray(items) ? items : [])
          })
          .catch(() => {
            if (!cancelled) setRelated([])
          })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setProduct(null)
        setRelated([])
        if (isAppError(err) && err.status === 404) {
          setNotFound(true)
          return
        }
        setError(isAppError(err) ? err.message : 'We could not load this product. Please try again.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [idOrSlug, reloadToken])

  return { product, related, loading, error, notFound, refetch: () => setReloadToken((t) => t + 1) }
}
