import { useMemo, useState } from 'react'
import { ArrowLeft, PackageCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { ProductCard } from '@/features/products/components/ProductCard'
import { ProductListSkeleton } from '@/features/products/components/ProductListSkeleton'
import { ProductTable, type ProductSort, type ProductSortField } from '@/features/products/components/ProductTable'
import { useLowStockAlerts } from '@/features/products/hooks/useLowStockAlerts'
import type { Product } from '@/features/products/types'

function sortProducts(products: Product[], sort: ProductSort): Product[] {
  const direction = sort.direction === 'asc' ? 1 : -1
  return [...products].sort((a, b) => {
    if (sort.field === 'active') return (Number(a.active) - Number(b.active)) * direction
    const a1 = a[sort.field]
    const b1 = b[sort.field]
    if (typeof a1 === 'string' && typeof b1 === 'string') return a1.localeCompare(b1) * direction
    return ((a1 as number) - (b1 as number)) * direction
  })
}

export function LowStockProductsPage() {
  const navigate = useNavigate()
  const { alerts, count, loading, hasLoadedOnce, error } = useLowStockAlerts()
  const [sort, setSort] = useState<ProductSort>({ field: 'name', direction: 'asc' })

  function handleSortChange(field: ProductSortField) {
    setSort((prev) =>
      prev.field === field ? { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { field, direction: 'asc' },
    )
  }

  const sorted = useMemo(() => sortProducts(alerts, sort), [alerts, sort])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/products')}
          aria-label="Back to products"
          className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Low-stock products</h1>
          <p className="text-sm text-neutral-500">Products at or below their low-stock threshold.</p>
        </div>
      </div>

      {loading && !hasLoadedOnce && <ProductListSkeleton />}

      {hasLoadedOnce && count === 0 && error && (
        <div className="rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      {hasLoadedOnce && count === 0 && !error && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-100 text-accent-600">
            <PackageCheck className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-neutral-900">You're all stocked up</h2>
          <p className="mt-1 max-w-sm text-sm text-neutral-500">No products are below their low-stock threshold right now.</p>
          <Link to="/products" className="mt-5 text-sm font-medium text-primary-600 hover:underline">
            Back to all products
          </Link>
        </div>
      )}

      {hasLoadedOnce && count > 0 && (
        <>
          <div className="flex flex-col gap-2 md:hidden">
            {sorted.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-lg border border-neutral-200 bg-white md:block">
            <ProductTable products={sorted} sort={sort} onSortChange={handleSortChange} />
          </div>
        </>
      )}
    </div>
  )
}
