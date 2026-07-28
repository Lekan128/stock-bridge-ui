import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  DEFAULT_CATALOG_SORT,
  isCatalogSort,
  type CatalogParams,
  type CatalogSort,
} from '@/features/storefront/types'

export interface CatalogFilters {
  q: string
  categoryId: string
  minPrice: string
  maxPrice: string
  inStockOnly: boolean
  sort: CatalogSort
  page: number
}

/** Everything except `page` — changing any of these has to send the shopper back to page 1. */
export type CatalogFilterPatch = Partial<Omit<CatalogFilters, 'page'>> & { page?: number }

export const CATALOG_PAGE_SIZE = 24

const EMPTY_FILTERS: Omit<CatalogFilters, 'sort' | 'page'> = {
  q: '',
  categoryId: '',
  minPrice: '',
  maxPrice: '',
  inStockOnly: false,
}

/** `"12500"` → 12500; anything non-numeric (or negative) is dropped rather than sent to the API. */
function toPositiveNumber(raw: string): number | undefined {
  if (raw.trim() === '') return undefined
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : undefined
}

/**
 * The catalog's filter state, stored in the URL query string rather than in component state.
 *
 * That is a product requirement, not a preference: a buyer sends "the 25kg rice under ₦40k" to a
 * colleague as a link, the browser back button has to undo a filter change, and the storefront
 * header already navigates to `/?q=…` and `/?categoryId=…` from outside this page — none of which
 * works if the grid owns the state internally.
 *
 * Default values are omitted from the URL entirely, so browsing everything stays a clean `/`.
 */
export function useCatalogFilters() {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo<CatalogFilters>(() => {
    const sortParam = searchParams.get('sort')
    const pageParam = Number(searchParams.get('page') ?? '1')
    return {
      q: searchParams.get('q') ?? '',
      categoryId: searchParams.get('categoryId') ?? '',
      minPrice: searchParams.get('minPrice') ?? '',
      maxPrice: searchParams.get('maxPrice') ?? '',
      inStockOnly: searchParams.get('inStockOnly') === 'true',
      sort: isCatalogSort(sortParam) ? sortParam : DEFAULT_CATALOG_SORT,
      // 1-based in the URL (what a human reads), 0-based everywhere the API and Pagination use it.
      page: Number.isFinite(pageParam) && pageParam > 1 ? Math.floor(pageParam) - 1 : 0,
    }
  }, [searchParams])

  const setFilters = useCallback(
    (patch: CatalogFilterPatch) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)

          const write = (key: string, value: string | undefined) => {
            if (value === undefined || value === '') next.delete(key)
            else next.set(key, value)
          }

          if ('q' in patch) write('q', patch.q?.trim())
          if ('categoryId' in patch) write('categoryId', patch.categoryId)
          if ('minPrice' in patch) write('minPrice', patch.minPrice)
          if ('maxPrice' in patch) write('maxPrice', patch.maxPrice)
          if ('inStockOnly' in patch) write('inStockOnly', patch.inStockOnly ? 'true' : undefined)
          if ('sort' in patch) write('sort', patch.sort === DEFAULT_CATALOG_SORT ? undefined : patch.sort)

          // Any filter change resets paging: page 7 of the old result set is almost never a
          // meaningful position in the new one, and landing on an empty page reads as a bug.
          const onlyPaging = Object.keys(patch).every((key) => key === 'page')
          const nextPage = onlyPaging ? (patch.page ?? 0) : 0
          write('page', nextPage > 0 ? String(nextPage + 1) : undefined)

          return next
        },
        // replace: false — a filter change is a navigation the back button should undo.
        { replace: false },
      )
    },
    [setSearchParams],
  )

  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: false })
  }, [setSearchParams])

  /** True when anything narrows the catalog — drives "no matches" vs "catalog is empty". */
  const hasActiveFilters =
    filters.q !== EMPTY_FILTERS.q ||
    filters.categoryId !== EMPTY_FILTERS.categoryId ||
    filters.minPrice !== EMPTY_FILTERS.minPrice ||
    filters.maxPrice !== EMPTY_FILTERS.maxPrice ||
    filters.inStockOnly !== EMPTY_FILTERS.inStockOnly

  /** The API-facing shape. Empty strings become omitted params, never `?q=`. */
  const params: CatalogParams = useMemo(
    () => ({
      q: filters.q.trim() || undefined,
      categoryId: filters.categoryId || undefined,
      minPrice: toPositiveNumber(filters.minPrice),
      maxPrice: toPositiveNumber(filters.maxPrice),
      inStockOnly: filters.inStockOnly || undefined,
      sort: filters.sort,
      page: filters.page,
      size: CATALOG_PAGE_SIZE,
    }),
    [filters],
  )

  return { filters, params, setFilters, clearFilters, hasActiveFilters }
}
