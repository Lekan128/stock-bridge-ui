import { useState } from 'react'
import { Pagination } from '@/components/Pagination'
import { useToast } from '@/components/useToast'
import { BulkUploadModal } from '@/features/products/components/BulkUploadModal'
import { EmptyProductsState } from '@/features/products/components/EmptyProductsState'
import { ProductCard } from '@/features/products/components/ProductCard'
import { ProductListSkeleton } from '@/features/products/components/ProductListSkeleton'
import { ProductTable, type ProductSort, type ProductSortField } from '@/features/products/components/ProductTable'
import { ProductsToolbar } from '@/features/products/components/ProductsToolbar'
import { productsApi } from '@/features/products/api/productsApi'
import { useProducts } from '@/features/products/hooks/useProducts'
import type { ProductStatusFilter } from '@/features/products/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { downloadBlob } from '@/utils/downloadBlob'

const PAGE_SIZE = 20

export function ProductListPage() {
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>('all')
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<ProductSort>({ field: 'name', direction: 'asc' })
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false)

  const debouncedSearch = useDebouncedValue(search, 350)

  const { data, loading, error, refetch } = useProducts({
    search: debouncedSearch || undefined,
    active: statusFilter === 'all' ? undefined : statusFilter === 'active',
    page,
    size: PAGE_SIZE,
    sort: `${sort.field},${sort.direction}`,
  })

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

  function handleBulkUploadSuccess(createdCount: number) {
    showToast(`${createdCount} product${createdCount === 1 ? '' : 's'} created.`, 'success')
    setPage(0)
    refetch()
  }

  const isUnfiltered = !debouncedSearch && statusFilter === 'all'
  const isTrulyEmpty = !loading && !error && isUnfiltered && (data?.content.length ?? 0) === 0 && page === 0

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-neutral-900">Products</h1>

      <ProductsToolbar
        search={search}
        onSearchChange={handleSearchChange}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        onBulkUpload={() => setBulkUploadOpen(true)}
        onDownloadTemplate={() => void handleDownloadTemplate()}
        onExport={() => void handleExport()}
      />

      {loading && <ProductListSkeleton />}

      {!loading && error && (
        <div className="rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      {!loading && !error && isTrulyEmpty && <EmptyProductsState onBulkUpload={() => setBulkUploadOpen(true)} />}

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
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <div className="hidden overflow-hidden rounded-lg border border-neutral-200 bg-white md:block">
                <ProductTable products={data.content} sort={sort} onSortChange={handleSortChange} />
              </div>
            </>
          )}
          <Pagination page={data.number} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      )}

      <BulkUploadModal
        open={bulkUploadOpen}
        onClose={() => setBulkUploadOpen(false)}
        onSuccess={handleBulkUploadSuccess}
      />
    </div>
  )
}
