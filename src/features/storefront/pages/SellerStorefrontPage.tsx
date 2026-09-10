import { PackageSearch, Store } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Pagination } from '@/components/Pagination'
import { CatalogGridSkeleton } from '@/features/storefront/components/CatalogGridSkeleton'
import { ProductGridCard } from '@/features/storefront/components/ProductGridCard'
import { useCatalog } from '@/features/storefront/hooks/useCatalog'
import { useCatalogFilters } from '@/features/storefront/hooks/useCatalogFilters'
import { useSeller } from '@/features/storefront/hooks/useSeller'

/**
 * One seller's storefront — route `/seller/:idOrSlug`.
 *
 * <h2>Why this exists rather than just a filtered `/`</h2>
 * VENDOR_RESEARCH.md Section A puts it plainly: buyers will not place a real purchase order with
 * an anonymous third party. A named page with the seller's own branding, reachable from every tile
 * they sell, is the cheapest way to make a vendor a party the buyer recognises rather than a
 * string on a product card.
 *
 * <h2>The products come from the ordinary catalog endpoint</h2>
 * The grid is `catalog({ sellerId })`, the same call `/` makes with one more parameter — not a
 * bespoke per-seller endpoint. That is deliberate: sorting, paging, stock projection and the
 * active-seller pin are all rules that must not have a second implementation to keep in step. It
 * also means the server, not this page, decides what may be shown; a seller id naming a suspended
 * vendor or a buying company narrows to nothing rather than exposing their inventory.
 *
 * <h2>Filters are deliberately not offered here</h2>
 * A vendor's catalog is small by definition. The seller id lives in the path rather than the query
 * string, so `clearFilters()` would navigate away from the seller entirely — offering a filter
 * rail whose "clear" button leaves the page would be worse than not offering one.
 */
export function SellerStorefrontPage() {
  const { idOrSlug } = useParams<{ idOrSlug: string }>()
  const { seller, loading: sellerLoading, error: sellerError } = useSeller(idOrSlug)
  const { filters, params, setFilters } = useCatalogFilters()

  // The seller resolves by id OR slug, but the catalog filter needs the id — so the grid waits for
  // the profile rather than guessing. `sellerId: ''` while loading would render the WHOLE catalog
  // for a moment, which would look like the vendor sells everything on the marketplace.
  const { data, products, loading, error, refetch } = useCatalog({
    ...params,
    sellerId: seller?.id ?? '__unresolved__',
  })

  if (sellerLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="h-24 animate-pulse rounded-lg bg-neutral-100" />
        <div className="mt-6">
          <CatalogGridSkeleton />
        </div>
      </div>
    )
  }

  if (!seller) {
    // One state for every reason the seller is unavailable — the API collapses "no such client",
    // "not a seller", "deactivated" and "nothing listed" on purpose, so the UI must not pretend to
    // know which it was.
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          icon={Store}
          title="This seller is not available"
          description={
            sellerError ??
            'They may no longer be selling on ProcurePaddy, or the link may be out of date. Browse the full catalog instead.'
          }
        />
      </div>
    )
  }

  const totalPages = data?.totalPages ?? 0
  const showSkeleton = loading && !data

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <header className="flex items-start gap-4 rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
        {seller.logoUrl ? (
          <img
            src={seller.logoUrl}
            alt=""
            aria-hidden="true"
            className="h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-neutral-200"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-neutral-100">
            <Store className="h-7 w-7 text-neutral-400" aria-hidden="true" />
          </div>
        )}

        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-neutral-900 sm:text-2xl">{seller.name}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {seller.platformOwner
              ? 'Sold and fulfilled by ProcurePal.'
              : 'A verified seller on the ProcurePaddy marketplace.'}
          </p>
          {/* The count comes from the server's own catalog predicate, so it can never disagree with
              the number of tiles below it. */}
          <p className="mt-2 text-sm text-neutral-600">
            {seller.productCount === 1 ? '1 product listed' : `${seller.productCount} products listed`}
          </p>
        </div>
      </header>

      <div className="mt-6">
        {error && (
          <ErrorState
            variant={products.length > 0 ? 'inline' : 'block'}
            title="We could not load these products"
            message={error}
            onRetry={refetch}
            className={products.length > 0 ? 'mb-4' : ''}
          />
        )}

        {showSkeleton && <CatalogGridSkeleton />}

        {!showSkeleton && products.length > 0 && (
          <>
            <div
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

        {!showSkeleton && !error && products.length === 0 && (
          <EmptyState
            icon={PackageSearch}
            title="Nothing listed right now"
            description={`${seller.name} has no products available at the moment. Check back soon.`}
          />
        )}
      </div>
    </div>
  )
}
