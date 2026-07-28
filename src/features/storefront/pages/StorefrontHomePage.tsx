import { useState } from 'react'
import { PackageSearch, SearchX } from 'lucide-react'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Modal } from '@/components/Modal'
import { Pagination } from '@/components/Pagination'
import { CatalogFilterPanel } from '@/features/storefront/components/CatalogFilterPanel'
import { CatalogGridSkeleton } from '@/features/storefront/components/CatalogGridSkeleton'
import { CatalogToolbar } from '@/features/storefront/components/CatalogToolbar'
import { CategoryStrip } from '@/features/storefront/components/CategoryStrip'
import { ProductGridCard } from '@/features/storefront/components/ProductGridCard'
import { StorefrontHero } from '@/features/storefront/components/StorefrontHero'
import { useCatalog } from '@/features/storefront/hooks/useCatalog'
import { useCatalogFilters } from '@/features/storefront/hooks/useCatalogFilters'
import { useCategories } from '@/features/storefront/hooks/useCategories'
import { useMarketplaceSettings } from '@/features/storefront/hooks/useMarketplaceSettings'

/**
 * The public marketplace catalog — route `/`.
 *
 * All filter state lives in the URL (see `useCatalogFilters`), so the header's search box and
 * category menu drive this page without any shared React state, and every view is a shareable link.
 *
 * Three distinct "nothing to show" outcomes are rendered differently on purpose (UX bar): a
 * request that failed, a filter that matched nothing, and a catalog with no products in it at all.
 * Collapsing them into one "No products" line hides which of the three the reader can fix.
 */
export function StorefrontHomePage() {
  const { filters, params, setFilters, clearFilters, hasActiveFilters } = useCatalogFilters()
  const { categories, loading: categoriesLoading } = useCategories()
  const { settings } = useMarketplaceSettings()
  const { data, products, loading, error, refetch } = useCatalog(params)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const totalPages = data?.totalPages ?? 0
  // First load has no previous page to keep on screen; later loads dim the old results instead of
  // blanking the grid (see useCatalog).
  const showSkeleton = loading && !data
  const isEmpty = !loading && !error && products.length === 0

  const filterPanel = (
    <CatalogFilterPanel
      filters={filters}
      onChange={(patch) => {
        setFilters(patch)
        setFiltersOpen(false)
      }}
      onClear={() => {
        clearFilters()
        setFiltersOpen(false)
      }}
      hasActiveFilters={hasActiveFilters}
      categories={categories}
      categoriesLoading={categoriesLoading}
    />
  )

  return (
    <div>
      <StorefrontHero settings={settings} />

      <div id="catalog" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <CategoryStrip
          categories={categories}
          loading={categoriesLoading}
          activeCategoryId={filters.categoryId}
          onSelect={(categoryId) => setFilters({ categoryId })}
        />

        <div className="mt-6 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
          {/* The rail is a sibling of the grid on desktop and a modal on mobile — one component,
              so the two can never drift apart. */}
          <aside className="hidden lg:block">
            <div className="sticky top-20">{filterPanel}</div>
          </aside>

          <div className="min-w-0">
            <CatalogToolbar
              filters={filters}
              onChange={setFilters}
              onClear={clearFilters}
              hasActiveFilters={hasActiveFilters}
              categories={categories}
              totalElements={data?.totalElements}
              loading={loading}
              onOpenFilters={() => setFiltersOpen(true)}
            />

            <div className="mt-4">
              {error && (
                <ErrorState
                  variant={products.length > 0 ? 'inline' : 'block'}
                  title="We could not load the catalog"
                  message={error}
                  onRetry={refetch}
                  className={products.length > 0 ? 'mb-4' : ''}
                />
              )}

              {showSkeleton && <CatalogGridSkeleton />}

              {!showSkeleton && products.length > 0 && (
                <>
                  <div
                    // Dimmed while a new page/filter is in flight: it says "this is stale" without
                    // throwing away results the reader is still looking at.
                    className={`grid grid-cols-2 gap-3 transition-opacity sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 ${
                      loading ? 'opacity-50' : 'opacity-100'
                    }`}
                  >
                    {products.map((product) => (
                      <ProductGridCard key={product.id} product={product} />
                    ))}
                  </div>

                  <Pagination
                    page={filters.page}
                    totalPages={totalPages}
                    onPageChange={(page) => {
                      setFilters({ page })
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    className="mt-8"
                  />
                </>
              )}

              {isEmpty &&
                (hasActiveFilters ? (
                  <EmptyState
                    icon={SearchX}
                    title="Nothing matches those filters"
                    description={
                      filters.q
                        ? `We could not find anything for “${filters.q}” with the filters you have applied. Try a broader search, or clear a filter.`
                        : 'No products match the filters you have applied. Try widening the price range or picking another category.'
                    }
                    action={
                      <>
                        <Button onClick={clearFilters}>Clear all filters</Button>
                        {filters.inStockOnly && (
                          <Button variant="secondary" onClick={() => setFilters({ inStockOnly: false })}>
                            Include out-of-stock items
                          </Button>
                        )}
                      </>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={PackageSearch}
                    title="The catalog is not open yet"
                    description="ProcurePal has not published any products for sale yet. Check back shortly — or get in touch and we will tell you when we go live."
                    action={
                      settings.supportEmail ? (
                        <a
                          href={`mailto:${settings.supportEmail}`}
                          className="rounded-md border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                        >
                          Email {settings.supportEmail}
                        </a>
                      ) : undefined
                    }
                  />
                ))}
            </div>
          </div>
        </div>
      </div>

      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filter products" size="md">
        {filterPanel}
      </Modal>
    </div>
  )
}
