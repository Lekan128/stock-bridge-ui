import { useState } from 'react'
import { Truck, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/Button'
import { Pagination } from '@/components/Pagination'
import { useToast } from '@/components/useToast'
import { EmptyProductsState } from '@/features/products/components/EmptyProductsState'
import { IncomingStockNotice } from '@/features/products/components/IncomingStockNotice'
import { NewProductSearchModal } from '@/features/products/components/NewProductSearchModal'
import { ProductCard } from '@/features/products/components/ProductCard'
import { ProductListSkeleton } from '@/features/products/components/ProductListSkeleton'
import { ProductTable, type ProductSort, type ProductSortField } from '@/features/products/components/ProductTable'
import { ProductsToolbar } from '@/features/products/components/ProductsToolbar'
import { productsApi } from '@/features/products/api/productsApi'
import { useProductIncoming } from '@/features/products/hooks/useProductIncoming'
import { useProducts } from '@/features/products/hooks/useProducts'
import type { ProductStatusFilter } from '@/features/products/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { downloadBlob } from '@/utils/downloadBlob'

const PAGE_SIZE = 20

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
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>('all')
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<ProductSort>({ field: 'name', direction: 'asc' })
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [addProductOpen, setAddProductOpen] = useState(false)

  const debouncedSearch = useDebouncedValue(search, 350)

  const { data, loading, error } = useProducts({
    search: debouncedSearch || undefined,
    active: statusFilter === 'all' ? undefined : statusFilter === 'active',
    page,
    size: PAGE_SIZE,
    sort: `${sort.field},${sort.direction}`,
  })

  // Stock bought from ProcurePal and not yet received. Surfaced beside — never inside — the
  // quantity on hand, so "12 usable, 20 incoming" can never be misread as 32 usable.
  const { incomingFor, totals: incomingTotals } = useProductIncoming(data?.content)

  function handleSortChange(field: ProductSortField) {
    setSort((prev) =>
      prev.field === field ? { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { field, direction: 'asc' },
    )
    setPage(0)
  }

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(0)
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
    setStatusFilter(value)
    setPage(0)
  }

  async function handleDownloadTemplate() {
    try {
      const blob = await productsApi.template()
      downloadBlob(blob, 'product-import-template.xlsx')
    } catch {
      showToast('Could not download the template. Please try again.', 'error')
    }
  }

  async function handleExport() {
    try {
      const blob = await productsApi.export()
      downloadBlob(blob, 'products-export.xlsx')
    } catch {
      showToast('Could not export products. Please try again.', 'error')
    }
  }

  const isUnfiltered = !debouncedSearch && statusFilter === 'all'
  const isTrulyEmpty = !loading && !error && isUnfiltered && (data?.content.length ?? 0) === 0 && page === 0

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-neutral-900">Inventory</h1>

      <IncomingStockNotice
        units={incomingTotals.units}
        productCount={incomingTotals.productCount}
        awaitingReceiptUnits={incomingTotals.awaitingReceiptUnits}
        approximate={incomingTotals.approximate}
      />

      <ProductsToolbar
        search={search}
        onSearchChange={handleSearchChange}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        canManageProducts={canManageProducts}
        onAddProduct={() => setAddProductOpen(true)}
        onBulkUpload={() => navigate('/app/products/import')}
        onDownloadTemplate={() => void handleDownloadTemplate()}
        onExport={() => void handleExport()}
      />

      {loading && <ProductListSkeleton />}

      {!loading && error && (
        <div className="rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      {!loading && !error && isTrulyEmpty && (
        <EmptyProductsState canManageProducts={canManageProducts} onBulkUpload={() => navigate('/app/products/import')} />
      )}

      {!loading && !error && !isTrulyEmpty && data && (
        <>
          {data.content.length === 0 ? (
            <p className="rounded-lg border border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-500">
              No products match your search.
            </p>
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
          <Pagination page={data.number} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      )}

      <NewProductSearchModal open={addProductOpen && canManageProducts} onClose={() => setAddProductOpen(false)} />
    </div>
  )
}
