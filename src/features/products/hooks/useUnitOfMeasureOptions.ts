import { useEffect, useState } from 'react'
import { productsApi } from '@/features/products/api/productsApi'
import type { UnitOfMeasureOption } from '@/features/products/types'

/**
 * The fixed unit-of-measure list, fetched once per page load and shared by every caller after
 * that — module-level, not per-hook-instance, because this list is now needed in several
 * unrelated places at once (the product form's picker, the product table's subtitle, the detail
 * page's label lookup) and it is static enough within a session that a second, third and fourth
 * network round trip for the same 28 rows would be pure waste.
 *
 * A failure is cached too (as `null`, distinct from "still loading"), so a flaky first request
 * does not retry on every mount — the picker just falls back to an empty list and the "request a
 * unit" link still works even if the canonical list never loads.
 */
let cache: UnitOfMeasureOption[] | null = null
let inFlight: Promise<UnitOfMeasureOption[]> | null = null

function fetchOnce(): Promise<UnitOfMeasureOption[]> {
  if (cache) return Promise.resolve(cache)
  if (!inFlight) {
    inFlight = productsApi
      .unitsOfMeasure()
      .then((options) => {
        cache = options
        return options
      })
      .finally(() => {
        inFlight = null
      })
  }
  return inFlight
}

/**
 * Splits `options` into the two picker option-sets the product form (and the table/detail pages'
 * label lookups) need, by `role`. Computed here — the one place — rather than in each of the
 * three call sites (`ProductFormPage`, `ProductTable`, `ProductDetailPage`) that would otherwise
 * each re-write the same `.filter(...)`.
 */
export function useUnitOfMeasureOptions() {
  const [options, setOptions] = useState<UnitOfMeasureOption[]>(cache ?? [])
  const [loading, setLoading] = useState(!cache)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cache) {
      setOptions(cache)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)

    fetchOnce()
      .then((opts) => {
        if (!cancelled) setOptions(opts)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load units of measure.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // `canBeStockUnit`/`canBePack`, not `role`: COUNT units serve either, so a `role` filter would
  // drop "Piece" from the pack picker. Falls back to `role` for a response predating those fields.
  const baseOptions = options.filter((option) => option.canBeStockUnit ?? option.role === 'BASE')
  const packagingOptions = options.filter((option) => option.canBePack ?? option.role === 'PACKAGING')

  return { options, baseOptions, packagingOptions, loading, error }
}
