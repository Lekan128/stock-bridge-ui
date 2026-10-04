import { useEffect, useState } from 'react'
import { Truck, X } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { Pagination } from '@/components/Pagination'
import { SavedDataNote } from '@/components/SavedDataNote'
import { useToast } from '@/components/useToast'
import { EmptyProductsState } from '@/features/products/components/EmptyProductsState'
import { IncomingStockNotice } from '@/features/products/components/IncomingStockNotice'
import { NewProductSearchModal } from '@/features/products/components/NewProductSearchModal'
import { ProductCard } from '@/features/products/components/ProductCard'
import { ProductListSkeleton } from '@/features/products/components/ProductListSkeleton'
import { ProductTable, type ProductSort, type ProductSortField } from '@/features/products/components/ProductTable'
import { ProductsToolbar, type StockLevelFilter } from '@/features/products/components/ProductsToolbar'
import { productsApi } from '@/features/products/api/productsApi'
import { DataIssuesBanner } from '@/features/products/quality/DataIssuesBanner'
import { ManageCategoriesModal } from '@/features/products/categories/ManageCategoriesModal'
import type { CompanyCategory } from '@/features/products/categories/types'
import { useCompanyCategories } from '@/features/products/categories/useCompanyCategories'
import { useProductIncoming } from '@/features/products/hooks/useProductIncoming'
import { useProducts } from '@/features/products/hooks/useProducts'
import type { ProductStatusFilter, StockStatusFilter } from '@/features/products/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { downloadBlob } from '@/utils/downloadBlob'

function isStockStatusFilter(value: string | null): value is StockStatusFilter {
  return value === 'OK' || value === 'LOW' || value === 'OUT'
}

const PAGE_SIZE = 20

const SORT_FIELDS: ProductSortField[] = ['name', 'sku', 'unitPrice', 'quantityOnHand', 'active']
const DEFAULT_SORT: ProductSort = { field: 'name', direction: 'asc' }

/**
 * The list's search, filters, sort and page, read from the URL.
 *
 * They used to be component state, so opening a product and coming back — the single most common
 * round trip on this screen — dropped the search, every filter and the page you were on. In the
 * URL they survive Back, a reload, and being pasted to a colleague. Defaults are left OUT of the
 * URL, so the plain list is still just `/app/products`.
 *
 * `status` defaults to ACTIVE, not all. The dashboard's "Well stocked / Low / Out of stock" counts
 * are active-only (`ProductRepository.count*ByClientId`), and the list they link into used to
 * include deactivated products — so a card reading "Out of stock: 3" could open onto five rows.
 * Deactivated products are one tap away under the status filter.
 */
interface ListState {
  search: string
  statusFilter: ProductStatusFilter
  categoryFilter: string
  stockLevelFilter: StockLevelFilter
  sort: ProductSort
  page: number
}

function readListState(params: URLSearchParams): ListState {
  const status = params.get('status')
  const stockStatus = params.get('stockStatus')
  const [sortField, sortDirection] = (params.get('sort') ?? '').split(',')
  const page = Number(params.get('page'))
  return {
    search: params.get('q') ?? '',
    statusFilter: status === 'all' || status === 'inactive' ? status : 'active',
    categoryFilter: params.get('category') ?? '',
    stockLevelFilter: isStockStatusFilter(stockStatus) ? stockStatus : 'all',
    sort: SORT_FIELDS.includes(sortField as ProductSortField)
      ? { field: sortField as ProductSortField, direction: sortDirection === 'desc' ? 'desc' : 'asc' }
      : DEFAULT_SORT,
    // 1-based in the URL, because people read it; 0-based everywhere else.
    page: Number.isInteger(page) && page > 1 ? page - 1 : 0,
  }
}

export function ProductListPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const permissions = user?.type === 'tenant' ? user.permissions : []
  const canManageProducts = permissions.includes(PERMISSIONS.MANAGE_PRODUCTS)
  /**
   * Who may reach the bulk import pipeline. Mirrors its controller exactly — MANAGE_PRODUCTS or
   * MANAGE_INVENTORY (bulk-import contract §3) — so a storekeeper, who holds only the second,
   * still sees the affordance that leads to bulk stock-in.
   */
  const canImport = canManageProducts || permissions.includes(PERMISSIONS.MANAGE_INVENTORY)
  const [searchParams, setSearchParams] = useSearchParams()
  const { search: committedSearch, statusFilter, categoryFilter, stockLevelFilter, sort, page } =
    readListState(searchParams)
  // What is in the box right now; the URL only takes it once typing pauses.
  const [search, setSearch] = useState(committedSearch)
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [addProductOpen, setAddProductOpen] = useState(false)

  const debouncedSearch = useDebouncedValue(search, 350)

  /**
   * Every change to the list's state goes through here. `replace`, so filtering and paging don't
   * pile up history entries — Back should leave the list, not undo the last chip. Anything that
   * changes WHICH rows match also goes back to page 1, since the old page may no longer exist.
   */
  function updateListState(patch: Record<string, string | null>, { resetPage = true } = {}) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        for (const [key, value] of Object.entries(patch)) {
          if (value == null || value === '') next.delete(key)
          else next.set(key, value)
        }
        if (resetPage) next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  useEffect(() => {
    if (debouncedSearch !== committedSearch) updateListState({ q: debouncedSearch })
    // Only a settled keystroke should write; the URL changing for any other reason must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  // The route requires VIEW_PRODUCTS, which is all the category list needs.
  const categoryList = useCompanyCategories(true)

  const { data, loading, error, refetch, showingSaved, updatedAt } = useProducts({
    search: committedSearch || undefined,
    active: statusFilter === 'all' ? undefined : statusFilter === 'active',
    categoryId: categoryFilter || undefined,
    stockStatus: stockLevelFilter === 'all' ? undefined : stockLevelFilter,
    page,
    size: PAGE_SIZE,
    sort: `${sort.field},${sort.direction}`,
  })

  // Stock bought from ProcurePal and not yet received. Surfaced beside — never inside — the
  // quantity on hand, so "12 usable, 20 incoming" can never be misread as 32 usable.
  const { incomingFor, totals: incomingTotals } = useProductIncoming(data?.content)

  function handleSortChange(field: ProductSortField) {
    const direction = sort.field === field && sort.direction === 'asc' ? 'desc' : 'asc'
    const isDefault = field === DEFAULT_SORT.field && direction === DEFAULT_SORT.direction
    updateListState({ sort: isDefault ? null : `${field},${direction}` })
  }

  function handlePageChange(nextPage: number) {
    updateListState({ page: nextPage > 0 ? String(nextPage + 1) : null }, { resetPage: false })
  }

  /**
   * Entry point into bulk stock-in for a chosen set of rows (spec §8.1). The ids ride in the
   * query string so the sheet downloaded on the next screen is pre-filled with exactly these
   * products — contract §3's `productIds`, which wins over `filter`.
   */
  function handleStockInSelected() {
    navigate(`/app/products/import/new?kind=STOCK_IN&productIds=${selectedIds.join(',')}`)
  }

  function toggleSelected(id: string, selected: boolean) {
    setSelectedIds((current) => (selected ? [...current, id] : current.filter((entry) => entry !== id)))
  }

  function toggleAllOnPage(selected: boolean) {
    const idsOnPage = (data?.content ?? []).map((product) => product.id)
    setSelectedIds((current) =>
      selected
        ? [...current.filter((id) => !idsOnPage.includes(id)), ...idsOnPage]
        : current.filter((id) => !idsOnPage.includes(id)),
    )
  }

  function handleStatusFilterChange(value: ProductStatusFilter) {
    updateListState({ status: value === 'active' ? null : value })
  }

  function handleCategoryFilterChange(categoryId: string) {
    updateListState({ category: categoryId })
  }

  function handleStockLevelFilterChange(value: StockLevelFilter) {
    updateListState({ stockStatus: value === 'all' ? null : value })
  }

  /** Whether any row on screen shows this category — and so says something stale after a change. */
  function isOnScreen(categoryId: string) {
    return (data?.content ?? []).some((product) => product.categoryId === categoryId)
  }

  /**
   * A rename changes what rows on screen say, so the page is reloaded when one of them is in that
   * category. A delete does the same, and a filter on the deleted category falls back to all of
   * them (which reloads anyway).
   */
  function handleCategorySaved(category: CompanyCategory) {
    categoryList.upsert(category)
    if (isOnScreen(category.id)) refetch()
  }

  function handleCategoryDeleted(category: CompanyCategory) {
    categoryList.remove(category.id)
    if (categoryFilter === category.id) handleCategoryFilterChange('')
    else if (isOnScreen(category.id)) refetch()
  }

  function closeManageCategories() {
    setManageCategoriesOpen(false)
    // Product counts are the server's to work out; fetch them fresh for next time.
    categoryList.reload()
  }

  async function handleExport() {
    try {
      const blob = await productsApi.export()
      downloadBlob(blob, 'products-export.xlsx')
    } catch {
      showToast('Could not export products. Please try again.', 'error')
    }
  }

  // "Nothing here yet" (the onboarding empty state) vs "nothing matches". With ACTIVE as the
  // default filter, an empty answer to the plain list is ambiguous — a brand-new catalog, or one
  // whose every product is deactivated — so that one case asks the server once more, unfiltered.
  const isDefaultView = !committedSearch && !categoryFilter && stockLevelFilter === 'all'
  const noResults = !loading && !error && data != null && data.totalElements === 0
  const activeViewIsEmpty = noResults && isDefaultView && statusFilter === 'active'
  const [catalogHasInactive, setCatalogHasInactive] = useState<boolean | null>(null)
  useEffect(() => {
    if (!activeViewIsEmpty) return
    let cancelled = false
    productsApi
      .list({ page: 0, size: 1 })
      .then((response) => {
        if (!cancelled) setCatalogHasInactive(response.totalElements > 0)
      })
      .catch(() => {
        if (!cancelled) setCatalogHasInactive(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeViewIsEmpty])
  const isTrulyEmpty =
    noResults && isDefaultView && (statusFilter === 'all' || (activeViewIsEmpty && catalogHasInactive === false))
  const onlyInactiveExist = activeViewIsEmpty && catalogHasInactive === true

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-neutral-900">Inventory</h1>

      <SavedDataNote showing={showingSaved} updatedAt={updatedAt} subject="stock levels" onRetry={refetch} />

      <DataIssuesBanner />

      <IncomingStockNotice
        units={incomingTotals.units}
        productCount={incomingTotals.productCount}
        awaitingReceiptUnits={incomingTotals.awaitingReceiptUnits}
        approximate={incomingTotals.approximate}
      />

      <ProductsToolbar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        stockLevelFilter={stockLevelFilter}
        onStockLevelFilterChange={handleStockLevelFilterChange}
        categories={categoryList.categories}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={handleCategoryFilterChange}
        canManageProducts={canManageProducts}
        canRecordDelivery={permissions.includes(PERMISSIONS.MANAGE_INVENTORY)}
        onAddProduct={() => setAddProductOpen(true)}
        onBulkUpload={() => navigate('/app/products/import')}
        onRecordDelivery={() => navigate('/app/products/receive')}
        onExpectedDeliveries={() => navigate('/app/products/expected')}
        onExport={() => void handleExport()}
        onSkuSettings={() => navigate('/app/products/sku-settings')}
        onManageCategories={() => setManageCategoriesOpen(true)}
      />

      {/* The skeleton is for the FIRST load only. After that the rows on screen stay put while the
          next answer loads — dimmed, with a thin bar — instead of the whole table unmounting into
          a skeleton on every keystroke, chip and page turn. */}
      {loading && !data && !error && <ProductListSkeleton />}

      {!loading && error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && isTrulyEmpty && (
        <EmptyProductsState canManageProducts={canManageProducts} onBulkUpload={() => navigate('/app/products/import')} />
      )}

      {!error && !isTrulyEmpty && data && (
        <div
          aria-busy={loading || undefined}
          className={`relative flex flex-col gap-4 transition-opacity duration-150 ${loading ? 'opacity-60' : ''}`}
        >
          {loading && (
            <div className="absolute inset-x-0 -top-2 h-0.5 overflow-hidden rounded-full bg-primary-100" aria-hidden="true">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-primary-500" />
            </div>
          )}
          {data.content.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-500">
              <p>
                {onlyInactiveExist
                  ? 'No active products. Every product in this catalog is deactivated.'
                  : categoryFilter && !committedSearch && statusFilter === 'all'
                    ? 'No products in this category yet. Choose a category on a product to add it here.'
                    : 'No products match your search.'}
              </p>
              {onlyInactiveExist && (
                <Button variant="secondary" onClick={() => handleStatusFilterChange('all')}>
                  Show all products
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2 md:hidden">
                {data.content.map((product) => (
                  <ProductCard key={product.id} product={product} incoming={incomingFor(product).quantity} />
                ))}
              </div>
              {/* The selection bar only exists on the desktop table — the mobile card list has
                  no checkboxes, matching how the import review screen drops its grid below `md`. */}
              {canImport && selectedIds.length > 0 && (
                <div className="hidden items-center justify-between gap-3 rounded-lg border border-primary-200 bg-primary-50 px-4 py-2.5 md:flex">
                  <p className="text-sm font-medium text-primary-900">
                    {selectedIds.length} product{selectedIds.length === 1 ? '' : 's'} selected
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={handleStockInSelected}>
                      <Truck className="h-4 w-4" aria-hidden="true" />
                      Stock in selected
                    </Button>
                    <button
                      type="button"
                      onClick={() => setSelectedIds([])}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-primary-800 hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      Clear
                    </button>
                  </div>
                </div>
              )}
              <div className="hidden overflow-hidden rounded-lg border border-neutral-200 bg-white md:block">
                <ProductTable
                  products={data.content}
                  sort={sort}
                  onSortChange={handleSortChange}
                  incomingFor={incomingFor}
                  selection={
                    canImport
                      ? { selectedIds, onToggle: toggleSelected, onToggleAll: toggleAllOnPage }
                      : undefined
                  }
                />
              </div>
            </>
          )}
          <Pagination page={data.number} totalPages={data.totalPages} onPageChange={handlePageChange} />
        </div>
      )}

      <ManageCategoriesModal
        open={manageCategoriesOpen && canManageProducts}
        onClose={closeManageCategories}
        categories={categoryList.categories}
        loading={categoryList.loading}
        loadError={categoryList.error}
        onRetry={categoryList.reload}
        onSaved={handleCategorySaved}
        onDeleted={handleCategoryDeleted}
      />

      <NewProductSearchModal open={addProductOpen && canManageProducts} onClose={() => setAddProductOpen(false)} />
    </div>
  )
}
