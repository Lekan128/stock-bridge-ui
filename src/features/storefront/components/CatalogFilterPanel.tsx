import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import type { CatalogFilterPatch, CatalogFilters } from '@/features/storefront/hooks/useCatalogFilters'
import { topLevelCategories, type MarketplaceCategory } from '@/features/storefront/types'
import { formatNairaWhole } from '@/utils/money'

export interface CatalogFilterPanelProps {
  filters: CatalogFilters
  onChange: (patch: CatalogFilterPatch) => void
  onClear: () => void
  hasActiveFilters: boolean
  categories: MarketplaceCategory[]
  categoriesLoading: boolean
}

/**
 * The filter rail: category, price range, availability.
 *
 * Price is committed on submit rather than on every keystroke. A debounced price field re-queries
 * on "1", "12", "125" on the way to "12500" — three wasted round trips and, worse, three
 * intermediate empty result sets flashing past the reader.
 */
export function CatalogFilterPanel({
  filters,
  onChange,
  onClear,
  hasActiveFilters,
  categories,
  categoriesLoading,
}: CatalogFilterPanelProps) {
  const [minDraft, setMinDraft] = useState(filters.minPrice)
  const [maxDraft, setMaxDraft] = useState(filters.maxPrice)

  // Keep the drafts honest when the URL changes from elsewhere (back button, "clear all",
  // a category link in the header).
  useEffect(() => {
    setMinDraft(filters.minPrice)
    setMaxDraft(filters.maxPrice)
  }, [filters.minPrice, filters.maxPrice])

  const roots = topLevelCategories(categories)
  const parents = roots.length > 0 ? roots : categories

  function applyPrice() {
    onChange({ minPrice: minDraft.trim(), maxPrice: maxDraft.trim() })
  }

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-neutral-900">Category</h3>
        {categoriesLoading ? (
          <p className="mt-2 text-sm text-neutral-400">Loading categories…</p>
        ) : parents.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No categories published yet.</p>
        ) : (
          <ul className="mt-2 space-y-0.5">
            <li>
              <button
                type="button"
                onClick={() => onChange({ categoryId: '' })}
                aria-current={filters.categoryId === '' ? 'true' : undefined}
                className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                  filters.categoryId === ''
                    ? 'bg-primary-50 font-medium text-primary-700'
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                All products
              </button>
            </li>
            {parents.map((category) => {
              const children = categories.filter((child) => child.parentId === category.id)
              return (
                <li key={category.id}>
                  <button
                    type="button"
                    onClick={() => onChange({ categoryId: category.id })}
                    aria-current={filters.categoryId === category.id ? 'true' : undefined}
                    className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                      filters.categoryId === category.id
                        ? 'bg-primary-50 font-medium text-primary-700'
                        : 'text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    <span className="truncate">{category.name}</span>
                    {category.productCount !== undefined && (
                      <span className="shrink-0 text-xs text-neutral-400">{category.productCount}</span>
                    )}
                  </button>
                  {children.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => onChange({ categoryId: child.id })}
                      aria-current={filters.categoryId === child.id ? 'true' : undefined}
                      className={`flex w-full items-center justify-between gap-2 rounded-md py-1.5 pl-5 pr-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                        filters.categoryId === child.id
                          ? 'bg-primary-50 font-medium text-primary-700'
                          : 'text-neutral-500 hover:bg-neutral-100'
                      }`}
                    >
                      <span className="truncate">{child.name}</span>
                      {child.productCount !== undefined && (
                        <span className="shrink-0 text-xs text-neutral-400">{child.productCount}</span>
                      )}
                    </button>
                  ))}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-neutral-900">Price per unit</h3>
        <form
          className="mt-2"
          onSubmit={(event) => {
            event.preventDefault()
            applyPrice()
          }}
        >
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor="catalog-min-price" className="sr-only">
                Minimum price in naira
              </label>
              <input
                id="catalog-min-price"
                type="text"
                inputMode="numeric"
                placeholder="Min"
                value={minDraft}
                onChange={(event) => setMinDraft(event.target.value.replace(/[^\d]/g, ''))}
                onBlur={applyPrice}
                className="w-full rounded-md border border-neutral-200 px-2.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <span aria-hidden="true" className="text-sm text-neutral-400">
              –
            </span>
            <div className="min-w-0 flex-1">
              <label htmlFor="catalog-max-price" className="sr-only">
                Maximum price in naira
              </label>
              <input
                id="catalog-max-price"
                type="text"
                inputMode="numeric"
                placeholder="Max"
                value={maxDraft}
                onChange={(event) => setMaxDraft(event.target.value.replace(/[^\d]/g, ''))}
                onBlur={applyPrice}
                className="w-full rounded-md border border-neutral-200 px-2.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
          </div>
          <p className="mt-1.5 text-xs text-neutral-500">
            {filters.minPrice || filters.maxPrice
              ? `Showing ${filters.minPrice ? formatNairaWhole(Number(filters.minPrice)) : 'any'} to ${filters.maxPrice ? formatNairaWhole(Number(filters.maxPrice)) : 'any'}`
              : 'Naira, per stock unit.'}
          </p>
          {/* Submit exists for keyboard users pressing Enter; blur covers the mouse path. */}
          <button type="submit" className="sr-only">
            Apply price range
          </button>
        </form>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-neutral-900">Availability</h3>
        <label className="mt-2 flex cursor-pointer items-start gap-2.5 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={filters.inStockOnly}
            onChange={(event) => onChange({ inStockOnly: event.target.checked })}
            className="mt-0.5 h-4 w-4 shrink-0 rounded-sm accent-primary-600"
          />
          <span>
            In stock only
            <span className="mt-0.5 block text-xs text-neutral-500">
              Hides lines ProcurePal is currently out of.
            </span>
          </span>
        </label>
      </section>

      {hasActiveFilters && (
        <Button variant="secondary" onClick={onClear} className="w-full">
          Clear all filters
        </Button>
      )}
    </div>
  )
}
