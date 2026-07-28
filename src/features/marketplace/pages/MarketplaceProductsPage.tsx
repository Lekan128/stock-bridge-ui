import { useEffect, useState } from 'react'
import { PackageSearch, Search, Store } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { Pagination } from '@/components/Pagination'
import { useToast } from '@/components/useToast'
import { marketplaceAdminApi } from '@/features/marketplace/api/marketplaceAdminApi'
import { BulkListingBar } from '@/features/marketplace/components/BulkListingBar'
import { CatalogProductCard } from '@/features/marketplace/components/CatalogProductCard'
import { CatalogProductTable } from '@/features/marketplace/components/CatalogProductTable'
import { CatalogSkeleton } from '@/features/marketplace/components/CatalogSkeleton'
import { CategoriesPanel } from '@/features/marketplace/components/CategoriesPanel'
import { MarketplaceDetailsModal } from '@/features/marketplace/components/MarketplaceDetailsModal'
import { QueryErrorState } from '@/features/marketplace/components/QueryErrorState'
import { SettingsPanel } from '@/features/marketplace/components/SettingsPanel'
import { useAdminCatalogProducts } from '@/features/marketplace/hooks/useAdminCatalogProducts'
import { useAdminCategories } from '@/features/marketplace/hooks/useAdminCategories'
import { useAdminSettings } from '@/features/marketplace/hooks/useAdminSettings'
import type { AdminCatalogProduct } from '@/features/marketplace/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { isAppError } from '@/types/api'

const PAGE_SIZE = 20

type CatalogTab = 'products' | 'categories' | 'settings'
type ListedFilter = 'all' | 'listed' | 'hidden'

const TABS: { value: CatalogTab; label: string }[] = [
  { value: 'products', label: 'Products' },
  { value: 'categories', label: 'Categories' },
  { value: 'settings', label: 'Settings' },
]

function parseTab(value: string | null): CatalogTab {
  return value === 'categories' || value === 'settings' ? value : 'products'
}

function parseListed(value: string | null): ListedFilter {
  return value === 'listed' || value === 'hidden' ? value : 'all'
}

/**
 * ProcurePal's catalog administration.
 *
 * Categories and the commercial settings deliberately have no routes of their own, so they live
 * here as tabs — with the tab in the query string, which keeps every view linkable and the back
 * button honest.
 *
 * The three tabs' data is fetched independently and each renders its own loading, empty and error
 * states: a settings endpoint having a bad day must not take the product list down with it.
 */
export function MarketplaceProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const { showToast } = useToast()

  const tab = parseTab(searchParams.get('tab'))
  const listedFilter = parseListed(searchParams.get('listed'))
  const categoryId = searchParams.get('categoryId') ?? ''
  const urlSearch = searchParams.get('q') ?? ''
  const page = Math.max(0, Number(searchParams.get('page') ?? '0') || 0)

  const [searchInput, setSearchInput] = useState(urlSearch)
  const debouncedSearch = useDebouncedValue(searchInput, 350)

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [pendingIds, setPendingIds] = useState<string[]>([])
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [editing, setEditing] = useState<AdminCatalogProduct | null>(null)

  function updateParams(patch: Record<string, string | null>) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        for (const [key, value] of Object.entries(patch)) {
          if (value === null || value === '') next.delete(key)
          else next.set(key, value)
        }
        return next
      },
      { replace: true },
    )
  }

  useEffect(() => {
    if (debouncedSearch === urlSearch) return
    updateParams({ q: debouncedSearch || null, page: null })
    // Reconciling the debounced box against the URL only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const { data, loading, error, refetch, patchProduct, replaceProduct } = useAdminCatalogProducts({
    q: urlSearch || undefined,
    categoryId: categoryId || undefined,
    listed: listedFilter === 'all' ? undefined : listedFilter === 'listed',
    page,
    size: PAGE_SIZE,
  })

  // Categories are needed by the products tab too (the filter and the edit modal), so they are
  // fetched once here rather than inside the categories panel.
  const categoriesState = useAdminCategories()
  const settingsState = useAdminSettings()

  const products = data?.content ?? []
  const hasActiveFilters = urlSearch !== '' || categoryId !== '' || listedFilter !== 'all'

  function resetFilters() {
    setSearchInput('')
    updateParams({ q: null, categoryId: null, listed: null, page: null })
  }

  /**
   * Optimistic listing toggle: the switch flips at once, and a failure puts it back and says so.
   * Deliberately not a refetch — with a "Listed only" filter active, refetching would make the row
   * the operator just touched vanish mid-click.
   */
  async function handleToggleListing(product: AdminCatalogProduct) {
    const nextListed = !product.listed
    setPendingIds((ids) => [...ids, product.id])
    patchProduct(product.id, { listed: nextListed })

    try {
      const updated = await marketplaceAdminApi.setListing(product.id, nextListed)
      replaceProduct(updated)
      showToast(
        nextListed ? `${product.name} is live on the storefront.` : `${product.name} is hidden from the storefront.`,
        'success',
      )
    } catch (err: unknown) {
      patchProduct(product.id, { listed: product.listed })
      showToast(isAppError(err) ? err.message : `${product.name} could not be updated.`, 'error')
    } finally {
      setPendingIds((ids) => ids.filter((id) => id !== product.id))
    }
  }

  /**
   * Bulk listing reports three numbers and all three are told to the operator: rows that changed,
   * rows that were already in that state, and rows the server refused. Reporting only the first
   * would turn "40 selected, 12 changed" into a silent mystery.
   */
  async function handleBulkListing(listed: boolean) {
    if (selectedIds.length === 0) return
    setBulkSubmitting(true)
    try {
      const result = await marketplaceAdminApi.bulkListing(selectedIds, listed)
      const parts = [`${result.updated} ${listed ? 'listed' : 'unlisted'}`]
      if (result.alreadyInState > 0) parts.push(`${result.alreadyInState} already ${listed ? 'listed' : 'hidden'}`)
      if (result.skipped.length > 0) parts.push(`${result.skipped.length} skipped`)
      showToast(parts.join(' · '), result.skipped.length > 0 ? 'info' : 'success')
      // The skipped ids stay selected so the operator can see exactly which rows need attention.
      setSelectedIds(result.skipped)
      refetch()
    } catch (err: unknown) {
      showToast(isAppError(err) ? err.message : 'That bulk change could not be applied.', 'error')
    } finally {
      setBulkSubmitting(false)
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id]))
  }

  function toggleSelectAll() {
    const pageIds = products.map((product) => product.id)
    const allSelected = pageIds.every((id) => selectedIds.includes(id))
    setSelectedIds(allSelected ? selectedIds.filter((id) => !pageIds.includes(id)) : [...new Set([...selectedIds, ...pageIds])])
  }

  const isEmpty = !loading && !error && products.length === 0

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Marketplace catalog</h1>
        <p className="mt-1 text-sm text-neutral-500">
          What ProcurePal sells on the public storefront, how it is grouped, and what customers are charged.
        </p>
      </div>

      <div role="tablist" aria-label="Catalog administration" className="flex gap-1 border-b border-neutral-200">
        {TABS.map((option) => {
          const selected = option.value === tab
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              id={`catalog-tab-${option.value}`}
              aria-selected={selected}
              aria-controls={`catalog-panel-${option.value}`}
              onClick={() => updateParams({ tab: option.value === 'products' ? null : option.value })}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none ${
                selected
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      {tab === 'products' && (
        <div
          role="tabpanel"
          id="catalog-panel-products"
          aria-labelledby="catalog-tab-products"
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3 lg:flex-row lg:items-end">
            <div className="flex-1">
              <label htmlFor="catalog-search" className="mb-1.5 block text-xs font-medium text-neutral-500">
                Search
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400"
                  aria-hidden="true"
                />
                <input
                  id="catalog-search"
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Product name, SKU or brand"
                  className="w-full rounded-md border border-neutral-200 py-2 pr-3 pl-9 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                />
              </div>
            </div>

            <div className="lg:w-56">
              <label htmlFor="catalog-category" className="mb-1.5 block text-xs font-medium text-neutral-500">
                Category
              </label>
              <select
                id="catalog-category"
                value={categoryId}
                onChange={(event) => updateParams({ categoryId: event.target.value || null, page: null })}
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
              >
                <option value="">Every category</option>
                {categoriesState.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-medium text-neutral-500">Listing</span>
              <div className="flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-0.5">
                {(
                  [
                    { value: 'all', label: 'All' },
                    { value: 'listed', label: 'Listed' },
                    { value: 'hidden', label: 'Hidden' },
                  ] as { value: ListedFilter; label: string }[]
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateParams({ listed: option.value === 'all' ? null : option.value, page: null })}
                    className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
                      listedFilter === option.value
                        ? 'bg-white text-neutral-900 shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {hasActiveFilters && (
              <Button variant="secondary" onClick={resetFilters}>
                Clear
              </Button>
            )}
          </div>

          {data && !error && !loading && (
            <p aria-live="polite" className="text-sm text-neutral-500">
              {data.totalElements} product{data.totalElements === 1 ? '' : 's'}
              {listedFilter === 'listed' ? ' listed on the storefront' : listedFilter === 'hidden' ? ' hidden from the storefront' : ''}
            </p>
          )}

          {loading && <CatalogSkeleton desktop={isDesktop} />}

          {!loading && error && (
            <QueryErrorState title="The catalog could not be loaded" message={error} onRetry={refetch} />
          )}

          {isEmpty && !hasActiveFilters && (
            <EmptyState
              icon={Store}
              title="Nothing in the catalog yet"
              description="Products come from ProcurePal's own inventory. Add them under Inventory first, then list them here to put them on the public storefront."
            />
          )}

          {isEmpty && hasActiveFilters && (
            <EmptyState
              icon={PackageSearch}
              title="No products match these filters"
              description="Nothing here matches what you asked for. Clear the filters to see the whole catalog."
              action={
                <Button variant="secondary" onClick={resetFilters}>
                  Clear filters
                </Button>
              }
            />
          )}

          {!loading && !error && products.length > 0 && (
            <>
              {isDesktop ? (
                <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
                  <CatalogProductTable
                    products={products}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                    onToggleSelectAll={toggleSelectAll}
                    onToggleListing={(product) => void handleToggleListing(product)}
                    onEdit={setEditing}
                    pendingIds={pendingIds}
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {products.map((product) => (
                    <CatalogProductCard
                      key={product.id}
                      product={product}
                      selected={selectedIds.includes(product.id)}
                      onToggleSelect={() => toggleSelect(product.id)}
                      onToggleListing={() => void handleToggleListing(product)}
                      onEdit={() => setEditing(product)}
                      pending={pendingIds.includes(product.id)}
                    />
                  ))}
                </div>
              )}

              {data && (
                <Pagination
                  page={data.number}
                  totalPages={data.totalPages}
                  onPageChange={(next) => updateParams({ page: String(next) })}
                />
              )}

              <BulkListingBar
                selectedCount={selectedIds.length}
                onList={() => void handleBulkListing(true)}
                onUnlist={() => void handleBulkListing(false)}
                onClear={() => setSelectedIds([])}
                submitting={bulkSubmitting}
              />
            </>
          )}
        </div>
      )}

      {tab === 'categories' && (
        <div role="tabpanel" id="catalog-panel-categories" aria-labelledby="catalog-tab-categories">
          <CategoriesPanel
            categories={categoriesState.categories}
            loading={categoriesState.loading}
            error={categoriesState.error}
            refetch={categoriesState.refetch}
          />
        </div>
      )}

      {tab === 'settings' && (
        <div role="tabpanel" id="catalog-panel-settings" aria-labelledby="catalog-tab-settings">
          <SettingsPanel
            settings={settingsState.settings}
            setSettings={settingsState.setSettings}
            loading={settingsState.loading}
            error={settingsState.error}
            refetch={settingsState.refetch}
          />
        </div>
      )}

      {editing && (
        <MarketplaceDetailsModal
          product={editing}
          categories={categoriesState.categories}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            replaceProduct(updated)
            setEditing(null)
            showToast(`${updated.name} updated.`, 'success')
            // Category counts move when a product changes category.
            categoriesState.refetch()
          }}
        />
      )}
    </div>
  )
}
