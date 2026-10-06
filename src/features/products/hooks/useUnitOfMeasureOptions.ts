import { queryKeys } from '@/data/queryKeys'
import { useApiQuery } from '@/data/useApiQuery'
import { productsApi } from '@/features/products/api/productsApi'
import type { UnitOfMeasureOption } from '@/features/products/types'

/**
 * The fixed unit-of-measure list — one cache entry shared by every caller (the product form's
 * picker, the table's unit symbols, the detail page's labels), as the module-level cache this
 * replaces was.
 *
 * Kept a day and saved on the device (A2): the list changes when a unit is added platform-wide,
 * which is rare, and every quantity on screen needs it to print "kg" rather than a code — so it
 * must be there offline too. A failure still falls back to an empty list, and the "request a
 * unit" link works regardless.
 */
const DAY_MS = 24 * 60 * 60 * 1000

/** Shared, so "no list yet" is the same array every render and never re-triggers an effect. */
const NO_OPTIONS: UnitOfMeasureOption[] = []

/**
 * Splits `options` into the two picker option-sets the product form (and the table/detail pages'
 * label lookups) need, by `role`. Computed here — the one place — rather than in each of the
 * three call sites (`ProductFormPage`, `ProductTable`, `ProductDetailPage`) that would otherwise
 * each re-write the same `.filter(...)`.
 */
export function useUnitOfMeasureOptions() {
  const result = useApiQuery<UnitOfMeasureOption[]>({
    queryKey: queryKeys.unitsOfMeasure,
    queryFn: () => productsApi.unitsOfMeasure(),
    fallbackError: 'Could not load units of measure.',
    staleTime: DAY_MS,
  })
  const options = result.data ?? NO_OPTIONS
  const { loading, error } = result

  // `canBeStockUnit`/`canBePack`, not `role`: COUNT units serve either, so a `role` filter would
  // drop "Piece" from the pack picker. Falls back to `role` for a response predating those fields.
  const baseOptions = options.filter((option) => option.canBeStockUnit ?? option.role === 'BASE')
  const packagingOptions = options.filter((option) => option.canBePack ?? option.role === 'PACKAGING')

  return { options, baseOptions, packagingOptions, loading, error }
}
