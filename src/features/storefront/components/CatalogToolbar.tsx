import { useEffect, useRef, useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import type { CatalogFilterPatch, CatalogFilters } from '@/features/storefront/hooks/useCatalogFilters'
import {
  CATALOG_SORTS,
  CATALOG_SORT_LABELS,
  type MarketplaceCategory,
} from '@/features/storefront/types'
import { formatNairaWhole } from '@/utils/money'

export interface CatalogToolbarProps {
  filters: CatalogFilters
  onChange: (patch: CatalogFilterPatch) => void
  onClear: () => void
  hasActiveFilters: boolean
  categories: MarketplaceCategory[]
  totalElements: number | undefined
  loading: boolean
  onOpenFilters: () => void
}

interface Chip {
  key: string
  label: string
  clear: CatalogFilterPatch
}

export function CatalogToolbar({
  filters,
  onChange,
  onClear,
  hasActiveFilters,
  categories,
  totalElements,
  loading,
  onOpenFilters,
}: CatalogToolbarProps) {
  const [draft, setDraft] = useState(filters.q)
  const debounced = useDebouncedValue(draft, 350)
  // The debounce must not fire on mount, or landing on `/?q=rice` would immediately push an
  // identical history entry and break the back button.
  const lastPushed = useRef(filters.q)

  // Adopt external changes to `q` (header search, back button, "clear all") without echoing
  // them straight back through the debounce.
  useEffect(() => {
    if (filters.q !== lastPushed.current) {
      lastPushed.current = filters.q
      setDraft(filters.q)
    }
  }, [filters.q])

  useEffect(() => {
    if (debounced.trim() === lastPushed.current.trim()) return
    lastPushed.current = debounced
    onChange({ q: debounced })
    // onChange is recreated per render by useSearchParams; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  const categoryName = categories.find((category) => category.id === filters.categoryId)?.name

  const chips: Chip[] = []
  if (filters.q) chips.push({ key: 'q', label: `“${filters.q}”`, clear: { q: '' } })
  if (filters.categoryId) {
    chips.push({ key: 'categoryId', label: categoryName ?? 'Selected category', clear: { categoryId: '' } })
  }
  if (filters.minPrice) {
    chips.push({ key: 'minPrice', label: `From ${formatNairaWhole(Number(filters.minPrice))}`, clear: { minPrice: '' } })
  }
  if (filters.maxPrice) {
    chips.push({ key: 'maxPrice', label: `Up to ${formatNairaWhole(Number(filters.maxPrice))}`, clear: { maxPrice: '' } })
  }
  if (filters.inStockOnly) chips.push({ key: 'inStockOnly', label: 'In stock only', clear: { inStockOnly: false } })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="relative min-w-0 flex-1 basis-full sm:basis-64">
          <label htmlFor="catalog-search" className="sr-only">
            Search the ProcurePal catalog
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            aria-hidden="true"
          />
          <input
            id="catalog-search"
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Search products, brands or SKUs"
            className="w-full rounded-md border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>

        <button
          type="button"
          onClick={onOpenFilters}
          className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 lg:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filters
          {chips.length > 0 && (
            <span className="rounded-full bg-primary-600 px-1.5 text-xs font-semibold text-white">{chips.length}</span>
          )}
        </button>

        <div className="ml-auto flex items-center gap-2">
          <label htmlFor="catalog-sort" className="hidden text-sm text-neutral-500 sm:block">
            Sort
          </label>
          <select
            id="catalog-sort"
            value={filters.sort}
            onChange={(event) => onChange({ sort: event.target.value as CatalogFilters['sort'] })}
            className="rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          >
            {CATALOG_SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {CATALOG_SORT_LABELS[sort]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* aria-live so a screen-reader user hears the result count change after filtering. */}
        <p aria-live="polite" className="text-sm text-neutral-500">
          {loading && totalElements === undefined
            ? 'Loading products…'
            : totalElements === undefined
              ? ''
              : `${totalElements.toLocaleString('en-NG')} ${totalElements === 1 ? 'product' : 'products'}`}
        </p>

        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => onChange(chip.clear)}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary-200 bg-primary-50 py-1 pl-2.5 pr-2 text-xs font-medium text-primary-700 hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <span className="truncate">{chip.label}</span>
            <X className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="sr-only">Remove this filter</span>
          </button>
        ))}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClear}
            className="rounded text-xs font-medium text-neutral-500 underline underline-offset-2 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  )
}
