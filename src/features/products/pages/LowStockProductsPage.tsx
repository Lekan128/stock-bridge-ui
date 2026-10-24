import { useMemo, useState } from 'react'
import { ArrowLeft, PackageCheck, Truck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { ProductCard } from '@/features/products/components/ProductCard'
import { ProductListSkeleton } from '@/features/products/components/ProductListSkeleton'
import { ProductTable, type ProductSort, type ProductSortField } from '@/features/products/components/ProductTable'
import { useLowStockAlerts } from '@/features/products/hooks/useLowStockAlerts'
import { useProductIncoming } from '@/features/products/hooks/useProductIncoming'
import type { Product } from '@/features/products/types'
import { scopeProduct } from '@/features/branches/scopeProduct'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'

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
  const { incomingFor } = useProductIncoming(alerts)

  // The genuinely useful bit: a product can be below its threshold *and* already have a delivery
  // on the way. Without saying so, this page reads as a shopping list and someone double-orders.
  const covered = useMemo(
    () => alerts.filter((product) => incomingFor(product).quantity > 0).length,
    [alerts, incomingFor],
  )

  function handleSortChange(field: ProductSortField) {
    setSort((prev) =>
      prev.field === field ? { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { field, direction: 'asc' },
    )
  }

  const sorted = useMemo(() => sortProducts(alerts, sort), [alerts, sort])

  // "All branches" (MULTI_BRANCH_UX_PLAN.md §5.1): low anywhere, grouped by the branch it is low at, each
  // with that branch's figure. A product low at two branches is under both.
  const branch = useOptionalWorkingBranch()
  const groups = useMemo(() => {
    if (!branch?.isMultiBranch || !branch.isAll) return null
    return branch.branches
      .filter((at) => at.active)
      .map((at) => ({
        branch: at,
        products: sorted
          .filter((product) => product.branchStock?.some((entry) => entry.branchId === at.id && entry.isLowStock))
          .map((product) => scopeProduct(product, at)),
      }))
      .filter((group) => group.products.length > 0)
  }, [branch, sorted])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/app/products')}
          aria-label="Back to inventory"
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
          <Link to="/app/products" className="mt-5 text-sm font-medium text-primary-600 hover:underline">
            Back to inventory
          </Link>
        </div>
      )}

      {hasLoadedOnce && count > 0 && (
        <>
          {covered > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-warning-200 bg-warning-50 p-4">
              <Truck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-warning-700" aria-hidden="true" />
              <p className="text-sm text-warning-900">
                <strong className="font-semibold">
                  {covered} of these {covered === 1 ? 'product' : 'products'} already{' '}
                  {covered === 1 ? 'has' : 'have'} stock on the way.
                </strong>{' '}
                Check the incoming figure before you re-order — the delivery may already cover the shortfall.
              </p>
            </div>
          )}
          {groups == null ? (
            <LowList products={sorted} sort={sort} onSortChange={handleSortChange} incomingFor={incomingFor} />
          ) : (
            groups.map((group) => (
              <section key={group.branch.id} aria-labelledby={`low-at-${group.branch.id}`} className="flex flex-col gap-2" data-low-group>
                <h2 id={`low-at-${group.branch.id}`} className="text-sm font-semibold text-neutral-900">
                  {group.branch.name} <span className="font-normal text-neutral-500">· {group.products.length} low</span>
                </h2>
                <LowList products={group.products} sort={sort} onSortChange={handleSortChange} incomingFor={incomingFor} />
              </section>
            ))
          )}
        </>
      )}
    </div>
  )
}

function LowList({
  products,
  sort,
  onSortChange,
  incomingFor,
}: {
  products: Product[]
  sort: ProductSort
  onSortChange: (field: ProductSortField) => void
  incomingFor: (product: Product) => { quantity: number }
}) {
  return (
    <>
      <div className="flex flex-col gap-2 md:hidden">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} incoming={incomingFor(product).quantity} />
        ))}
      </div>
      <div className="hidden overflow-hidden rounded-lg border border-neutral-200 bg-white md:block">
        <ProductTable products={products} sort={sort} onSortChange={onSortChange} incomingFor={incomingFor} />
      </div>
    </>
  )
}
