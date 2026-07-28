import { useEffect, useState } from 'react'
import { storefrontApi } from '@/features/storefront/api/storefrontApi'
import type { MarketplaceCategory } from '@/features/storefront/types'

/**
 * Categories for the storefront header menu and (later) the catalog filter rail.
 *
 * Failure is deliberately silent — no error state is surfaced. The categories menu is a
 * navigational nicety on top of a search box that works without it, so a missing or not-yet-built
 * `/api/marketplace/categories` must degrade to "no menu", never to an error banner across the
 * whole storefront chrome.
 */
export function useCategories() {
  const [categories, setCategories] = useState<MarketplaceCategory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    storefrontApi
      .categories()
      .then((data) => {
        if (!cancelled) setCategories(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setCategories([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { categories, loading }
}
