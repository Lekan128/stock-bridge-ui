import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Truck, X, Zap } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { Pagination } from '@/components/Pagination'
import { SavedDataNote } from '@/components/SavedDataNote'
import { CatalogProductList } from '@/features/catalog/CatalogProductList'
import { syncCatalog } from '@/features/catalog/catalogStore'
import { useCatalogList, useCatalogState, type CatalogList } from '@/features/catalog/useCatalog'
import { useToast } from '@/components/useToast'
import { EmptyProductsState } from '@/features/products/components/EmptyProductsState'
import { IncomingStockNotice } from '@/features/products/components/IncomingStockNotice'
import { NewProductSearchModal } from '@/features/products/components/NewProductSearchModal'
import { ProductCard } from '@/features/products/components/ProductCard'
import { ProductListSkeleton } from '@/features/products/components/ProductListSkeleton'
import {
  ProductTable,
  type ProductQuickActions,
  type ProductSort,
  type ProductSortField,
  type ProductTableSelection,
} from '@/features/products/components/ProductTable'
import { AttentionLine, type AttentionItem } from '@/features/products/components/AttentionLine'
import { InventoryActionBar } from '@/features/products/components/InventoryActionBar'
import { InventoryBar, type InventoryBarProps, type StockLevelFilter } from '@/features/products/components/InventoryBar'
import { useStockActions } from '@/features/products/hooks/useStockActions'
import type { CardSelection } from '@/features/catalog/CatalogProductList'
import { useDataIssuesNotice } from '@/features/products/quality/useDataIssuesNotice'
import { productsApi } from '@/features/products/api/productsApi'
import { DataIssuesBanner } from '@/features/products/quality/DataIssuesBanner'
import { ManageCategoriesModal } from '@/features/products/categories/ManageCategoriesModal'
import type { CompanyCategory } from '@/features/products/categories/types'
import { useCompanyCategories } from '@/features/products/categories/useCompanyCategories'
import { useProductIncoming } from '@/features/products/hooks/useProductIncoming'
import { useProducts } from '@/features/products/hooks/useProducts'
import type { Product, ProductStatusFilter, StockStatusFilter } from '@/features/products/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { downloadBlob } from '@/utils/downloadBlob'

function isStockStatusFilter(value: string | null): value is StockStatusFilter {
  return value === 'OK' || value === 'LOW' || value === 'OUT'
}

const PAGE_SIZE = 20
/** How long typing pauses before a search runs: against the server, and on the phone's copy. */
const SERVER_SEARCH_PAUSE_MS = 350
const DEVICE_SEARCH_PAUSE_MS = 100

const NO_PRODUCTS: Product[] = []

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
  const canStockIn = permissions.includes(PERMISSIONS.STOCK_IN)
  const canStockOut = permissions.includes(PERMISSIONS.STOCK_OUT)
  const [searchParams, setSearchParams] = useSearchParams()
  const { search: committedSearch, statusFilter, categoryFilter, stockLevelFilter, sort, page } =
    readListState(searchParams)
  // What is in the box right now; the URL only takes it once typing pauses.
  const [search, setSearch] = useState(committedSearch)
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [addProductOpen, setAddProductOpen] = useState(false)
  /** Phone selection (long press) is a mode; the desktop table's checkboxes are always there. */
  const [selecting, setSelecting] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  /**
   * Where the list comes from. Once a complete copy of the catalogue is on the device (A3), every
   * search, filter, sort and scroll is answered there — instantly, offline included, at any
   * catalogue size. Until then (the first download, or a device too full to hold one) it is the
   * server's paged list, exactly as before.
   */
  const catalog = useCatalogState()
  const onDevice = catalog.phase === 'ready'

  // The pause before a search runs is there to spare the server a request per keystroke. Answered
  // on the phone (~30 ms at 100,000 products on a throttled CPU, Phase H) there is nothing to
  // spare, so it only has to be long enough to let a scanner's burst of keys land as one search.
  const debouncedSearch = useDebouncedValue(search, onDevice ? DEVICE_SEARCH_PAUSE_MS : SERVER_SEARCH_PAUSE_MS)

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

  const online = useOnlineStatus()
  const catalogList = useCatalogList(
    { search: committedSearch, status: statusFilter, categoryId: categoryFilter, stockStatus: stockLevelFilter, sort },
    onDevice,
  )
  const [renderedProducts, setRenderedProducts] = useState<Product[]>([])

  const server = useProducts(
    {
      search: committedSearch || undefined,
      active: statusFilter === 'all' ? undefined : statusFilter === 'active',
      categoryId: categoryFilter || undefined,
      stockStatus: stockLevelFilter === 'all' ? undefined : stockLevelFilter,
      page,
      size: PAGE_SIZE,
      sort: `${sort.field},${sort.direction}`,
    },
    { enabled: !onDevice },
  )
  const { data, loading, error, refetch } = server
  const showingSaved = onDevice ? (!online || catalog.behind) && catalog.syncedAt != null : server.showingSaved
  const updatedAt = onDevice ? catalog.syncedAt : server.updatedAt
  const retryRefresh = onDevice ? () => void syncCatalog() : refetch

  // Quick stock in / out from a row or card (C1, U2): the same sheets and Undo as the product page.
  // The device catalogue and caches update through the outbox; the server's paged list is refetched.
  const stockActions = useStockActions({ onChanged: () => (onDevice ? undefined : refetch()) })
  const quickActions: ProductQuickActions | undefined =
    canStockIn || canStockOut ? { canStockIn, canStockOut, onAction: (kind, product) => stockActions.open(kind, product) } : undefined

  // Stock bought from ProcurePal and not yet received. Surfaced beside — never inside — the
  // quantity on hand, so "12 usable, 20 incoming" can never be misread as 32 usable.
  // On the device every row already carries its incoming figure, so nothing needs deriving from
  // orders; an empty list says exactly that and asks the server for nothing.
  const { incomingFor, totals: serverIncomingTotals } = useProductIncoming(onDevice ? NO_PRODUCTS : data?.content)
  const incomingTotals = onDevice
    ? { ...catalogList.incoming, awaitingReceiptUnits: 0, approximate: false }
    : serverIncomingTotals

  // The notices that used to stack above the list, folded into one line (C1, U1).
  const dataIssues = useDataIssuesNotice()
  const attention: AttentionItem[] = []
  if (dataIssues.issues.length > 0) {
    const count = dataIssues.issues.length
    attention.push({
      key: 'data-issues',
      summary: `${count} ${count === 1 ? 'product needs' : 'products need'} a quick fix`,
      content: <DataIssuesBanner issues={dataIssues.issues} onDismiss={dataIssues.dismiss} />,
    })
  }
  if (incomingTotals.units > 0) {
    attention.push({
      key: 'incoming',
      summary:
        incomingTotals.awaitingReceiptUnits > 0
          ? `${incomingTotals.awaitingReceiptUnits} units delivered, waiting for you to confirm`
          : `${incomingTotals.approximate ? 'at least ' : ''}${incomingTotals.units} units on the way`,
      content: (
        <IncomingStockNotice
          units={incomingTotals.units}
          productCount={incomingTotals.productCount}
          awaitingReceiptUnits={incomingTotals.awaitingReceiptUnits}
          approximate={incomingTotals.approximate}
        />
      ),
    })
  }

  // The rows on screen, for the keyboard (C1): `/` search, j/k move, i/o stock in or out, Enter open.
  const shownRef = useRef<Product[]>([])
  shownRef.current = onDevice ? renderedProducts : (data?.content ?? [])
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]')) return
      if (document.getElementById('root')?.inert) return
      if (event.key === '/') {
        event.preventDefault()
        searchRef.current?.focus()
        return
      }
      if (!['j', 'k', 'i', 'o'].includes(event.key)) return
      const rows = [...document.querySelectorAll<HTMLElement>('[data-product-row]')].filter((row) => row.offsetParent !== null)
      if (rows.length === 0) return
      const current = rows.findIndex((row) => row.contains(document.activeElement))
      if (event.key === 'j' || event.key === 'k') {
        event.preventDefault()
        const next = current === -1 ? 0 : Math.min(rows.length - 1, Math.max(0, current + (event.key === 'j' ? 1 : -1)))
        rows[next].querySelector<HTMLElement>('[data-row-link]')?.focus()
        rows[next].scrollIntoView({ block: 'nearest' })
        return
      }
      if (current === -1) return
      const product = shownRef.current.find((entry) => entry.id === rows[current].dataset.productRow)
      if (!product) return
      if (event.key === 'i' && canStockIn) {
        event.preventDefault()
        stockActions.open('in', product)
      } else if (event.key === 'o' && canStockOut) {
        event.preventDefault()
        stockActions.open('out', product)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  })

  /** Phone selection: a long press starts it with that card ticked. */
  const cardSelection: CardSelection | undefined = canImport
    ? {
        active: selecting,
        selectedIds,
        onToggle: (id) => toggleSelected(id, !selectedIds.includes(id)),
        onStart: (id) => {
          setSelecting(true)
          if (!selectedIds.includes(id)) toggleSelected(id, true)
        },
      }
    : undefined

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
    const idsOnPage = (onDevice ? renderedProducts : (data?.content ?? [])).map((product) => product.id)
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
    // A rename changes the name on every product in it; the feed carries that to the device copy.
    void syncCatalog()
    if (isOnScreen(category.id)) refetch()
  }

  function handleCategoryDeleted(category: CompanyCategory) {
    categoryList.remove(category.id)
    void syncCatalog()
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

  const barProps: InventoryBarProps = {
    search,
    onSearchChange: setSearch,
    statusFilter,
    onStatusFilterChange: handleStatusFilterChange,
    stockLevelFilter,
    onStockLevelFilterChange: handleStockLevelFilterChange,
    stockLevelCounts:
      onDevice && catalogList.ready
        ? { all: catalogList.counts.all, OK: catalogList.counts.OK, LOW: catalogList.counts.LOW, OUT: catalogList.counts.OUT }
        : undefined,
    categories: categoryList.categories,
    categoryFilter,
    onCategoryFilterChange: handleCategoryFilterChange,
    onClearFilters: () => updateListState({ status: null, category: null }),
    canManageProducts,
    canRecordDelivery: permissions.includes(PERMISSIONS.MANAGE_INVENTORY),
    onQuickMode: canStockIn || canStockOut || permissions.includes(PERMISSIONS.MANAGE_INVENTORY) ? () => navigate('/app/quick') : undefined,
    onAddProduct: () => setAddProductOpen(true),
    onBulkUpload: () => navigate('/app/products/import'),
    onRecordDelivery: () => navigate('/app/products/receive'),
    onExpectedDeliveries: () => navigate('/app/products/expected'),
    onExport: () => void handleExport(),
    onSkuSettings: () => navigate('/app/products/sku-settings'),
    onManageCategories: () => setManageCategoriesOpen(true),
  }

  return (
    // Room at the bottom on a phone for the action bar pinned there.
    <div className="flex flex-col gap-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Inventory</h1>
        {/* On a phone, quick mode is one tap from the list (C4); on a laptop it is in "⋯". */}
        {barProps.onQuickMode && (
          <button
            type="button"
            onClick={barProps.onQuickMode}
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 md:hidden"
          >
            <Zap className="h-4 w-4" aria-hidden="true" />
            Quick mode
          </button>
        )}
      </div>

      <SavedDataNote showing={showingSaved} updatedAt={updatedAt} subject="stock levels" onRetry={retryRefresh} />

      {/* The first full download, on a catalogue big enough for it to take a moment. Smaller ones
          finish before this could be read. */}
      {catalog.phase === 'loading' && (catalog.total ?? 0) > 2000 && (
        <p role="status" className="text-sm text-neutral-500">
          Getting your stock list ready to work offline ·{' '}
          <span className="tabular-nums">
            {catalog.loaded.toLocaleString()} of {(catalog.total ?? 0).toLocaleString()}
          </span>
        </p>
      )}

      <InventoryBar ref={searchRef} {...barProps} />

      <AttentionLine items={attention} />

      {/* The skeleton is for the FIRST load only. After that the rows on screen stay put while the
          next answer loads — dimmed, with a thin bar — instead of the whole table unmounting into
          a skeleton on every keystroke, chip and page turn. */}
      {onDevice && (
        <OnDeviceList
          list={catalogList}
          sort={sort}
          onSortChange={handleSortChange}
          isDefaultView={isDefaultView}
          statusFilter={statusFilter}
          categoryFilter={categoryFilter}
          committedSearch={committedSearch}
          canManageProducts={canManageProducts}
          onBulkUpload={() => navigate('/app/products/import')}
          onShowAll={() => handleStatusFilterChange('all')}
          selection={canImport ? { selectedIds, onToggle: toggleSelected, onToggleAll: toggleAllOnPage } : undefined}
          selectionBar={
            canImport && selectedIds.length > 0 ? (
              <SelectionBar count={selectedIds.length} onStockIn={handleStockInSelected} onClear={() => setSelectedIds([])} />
            ) : null
          }
          onRenderedChange={setRenderedProducts}
          quickActions={quickActions}
          cardSelection={cardSelection}
        />
      )}

      {!onDevice && loading && !data && !error && <ProductListSkeleton />}

      {!onDevice && !loading && error && <ErrorState message={error} onRetry={refetch} />}

      {!onDevice && !loading && !error && isTrulyEmpty && (
        <EmptyProductsState canManageProducts={canManageProducts} onBulkUpload={() => navigate('/app/products/import')} />
      )}

      {!onDevice && !error && !isTrulyEmpty && data && (
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
                  <ProductCard
                    key={product.id}
                    product={product}
                    incoming={incomingFor(product).quantity}
                    quickActions={quickActions}
                    selection={
                      cardSelection && {
                        active: cardSelection.active,
                        selected: selectedIds.includes(product.id),
                        onToggle: () => cardSelection.onToggle(product.id),
                        onLongPress: () => cardSelection.onStart(product.id),
                      }
                    }
                  />
                ))}
              </div>
              {/* On a phone, selection lives in the bottom bar instead (C1, U4). */}
              {canImport && selectedIds.length > 0 && (
                <SelectionBar count={selectedIds.length} onStockIn={handleStockInSelected} onClear={() => setSelectedIds([])} />
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
                  quickActions={quickActions}
                />
              </div>
            </>
          )}
          <Pagination page={data.number} totalPages={data.totalPages} onPageChange={handlePageChange} />
        </div>
      )}

      {/* Said once, quietly, where a keyboard user is looking: under the list. */}
      <p className="hidden text-xs text-neutral-500 md:block">
        Keys: <Kbd>/</Kbd> search · <Kbd>j</Kbd> <Kbd>k</Kbd> move between products
        {canStockIn && (
          <>
            {' '}· <Kbd>i</Kbd> stock in
          </>
        )}
        {canStockOut && (
          <>
            {' '}· <Kbd>o</Kbd> stock out
          </>
        )}{' '}
        · <Kbd>Enter</Kbd> open
      </p>

      <InventoryActionBar
        {...barProps}
        selecting={selecting}
        selectedCount={selectedIds.length}
        canStockInSelected={canImport}
        onStockInSelected={handleStockInSelected}
        onDoneSelecting={() => {
          setSelecting(false)
          setSelectedIds([])
        }}
      />

      {stockActions.sheet}

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

/** "3 products selected · Stock in selected · Clear" above the desktop table. */
function SelectionBar({ count, onStockIn, onClear }: { count: number; onStockIn: () => void; onClear: () => void }) {
  return (
    <div className="hidden items-center justify-between gap-3 rounded-lg border border-primary-200 bg-primary-50 px-4 py-2.5 md:flex">
      <p className="text-sm font-medium text-primary-900">
        {count} product{count === 1 ? '' : 's'} selected
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={onStockIn}>
          <Truck className="h-4 w-4" aria-hidden="true" />
          Stock in selected
        </Button>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-primary-800 hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Clear
        </button>
      </div>
    </div>
  )
}

interface OnDeviceListProps {
  list: CatalogList
  sort: ProductSort
  onSortChange: (field: ProductSortField) => void
  isDefaultView: boolean
  statusFilter: ProductStatusFilter
  categoryFilter: string
  committedSearch: string
  canManageProducts: boolean
  onBulkUpload: () => void
  onShowAll: () => void
  selection?: ProductTableSelection
  selectionBar: ReactNode
  onRenderedChange: (products: Product[]) => void
  quickActions?: ProductQuickActions
  cardSelection?: CardSelection
}

/**
 * The list when it is read from the on-device catalogue: the same empty states as the server
 * list, decided from the catalogue's own counts instead of an extra request.
 */
function OnDeviceList({
  list,
  sort,
  onSortChange,
  isDefaultView,
  statusFilter,
  categoryFilter,
  committedSearch,
  canManageProducts,
  onBulkUpload,
  onShowAll,
  selection,
  selectionBar,
  onRenderedChange,
  quickActions,
  cardSelection,
}: OnDeviceListProps) {
  if (!list.ready) return <ProductListSkeleton />
  if (list.catalogSize === 0) {
    return <EmptyProductsState canManageProducts={canManageProducts} onBulkUpload={onBulkUpload} />
  }
  if (list.total === 0) {
    const onlyInactiveExist = isDefaultView && statusFilter === 'active' && list.activeCount === 0
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-500">
        <p>
          {onlyInactiveExist
            ? 'No active products. Every product in this catalog is deactivated.'
            : categoryFilter && !committedSearch && statusFilter === 'all'
              ? 'No products in this category yet. Choose a category on a product to add it here.'
              : 'No products match your search.'}
        </p>
        {onlyInactiveExist && (
          <Button variant="secondary" onClick={onShowAll}>
            Show all products
          </Button>
        )}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      {selectionBar}
      <CatalogProductList
        list={list}
        sort={sort}
        onSortChange={onSortChange}
        selection={selection}
        onRenderedChange={onRenderedChange}
        quickActions={quickActions}
        cardSelection={cardSelection}
      />
    </div>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-sm border border-neutral-200 bg-white px-1 font-sans text-[11px] text-neutral-600">{children}</kbd>
}
