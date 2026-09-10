import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleX, PackageSearch, Pencil, Plus, Search } from 'lucide-react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { Badge } from '@/components/Badge'
import { buttonClassName } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Pagination } from '@/components/Pagination'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/components/useToast'
import { ListingToggle } from '@/features/marketplace/components/ListingToggle'
import { vendorCatalogueApi } from '@/features/vendor/api/vendorCatalogueApi'
import { ApprovalStatusBadge } from '@/features/vendor/components/ApprovalStatusBadge'
import { useVendorCatalogue } from '@/features/vendor/hooks/useVendorCatalogue'
import type { VendorCatalogueProduct } from '@/features/vendor/types'
import { isAppError } from '@/types/api'
import { formatNaira } from '@/utils/money'

const PAGE_SIZE = 20

type ListedFilter = 'all' | 'listed' | 'unlisted'

/**
 * A seller's own catalogue — `/app/selling/catalogue`.
 *
 * <h2>The one question this screen exists to answer</h2>
 * "My product is listed. Why can nobody see it?" A listing reaches the public storefront only
 * when TWO flags agree — the seller's `listed` ("I want this sold") and the platform's
 * `approvalStatus` ("you may") — and only the first is the seller's to set. A catalogue screen
 * showing just the toggle cannot explain a product that is switched on and invisible, and a
 * REJECTED listing whose reason is off screen produces a support ticket instead of a fix.
 * So every row carries both, and a rejected row opens out into its reason and the way back in.
 *
 * <h2>Resubmission is an edit, not a button</h2>
 * There is no "resubmit" action here, and that is the server's design rather than an omission:
 * changing what a product IS — its name, SKU, description, brand, photo or unit of measure —
 * returns it to review automatically, because what makes a refused listing worth a second look
 * is that it CHANGED. So the affordance on a rejected row is "Edit listing", pointing at the
 * ordinary product form — the same one every tenant uses, and the only place these fields are
 * written. Price and stock edits deliberately do NOT re-trigger review, so correcting a
 * quantity never costs a seller their approval.
 *
 * <h2>Where the rule is explained, and why not only here</h2>
 * This screen states the rule once, in one line under the heading, and the product form states
 * it properly: `ReviewImpactNotice` enumerates both groups of fields by name, and
 * `ReviewImpactDialog` confirms at the point of saving, naming the fields that actually
 * changed. That split is deliberate. A catalogue screen is where a vendor learns the rule
 * exists; the form is where they are about to break it, and a warning is worth most at the
 * moment of the action rather than on the screen before it.
 *
 * <h2>Why the listing toggle is optimistic and the rest is not</h2>
 * Flipping `listed` is one boolean on one row and rolls back cleanly; making the seller watch a
 * spinner for it would make the switch feel broken. Everything else on this screen is a read.
 */
export function VendorCataloguePage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [listedFilter, setListedFilter] = useState<ListedFilter>('all')
  const [page, setPageNumber] = useState(0)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const { page: result, setPage, loading, error, refetch } = useVendorCatalogue({
    q: search || undefined,
    listed: listedFilter === 'all' ? undefined : listedFilter === 'listed',
    page,
    size: PAGE_SIZE,
  })

  const canManage = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.MANAGE_MARKETPLACE)
  const canEditProducts = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.MANAGE_PRODUCTS)

  function applySearch(next: string) {
    setSearch(next)
    // Reset to the first page: staying on page 3 of a narrower result set shows an empty table
    // and reads as "the search found nothing".
    setPageNumber(0)
  }

  async function handleToggleListing(product: VendorCatalogueProduct, listed: boolean) {
    setTogglingId(product.id)
    const previous = result
    setPage((current) => ({
      ...current,
      content: current.content.map((row) => (row.id === product.id ? { ...row, listed } : row)),
    }))
    try {
      await vendorCatalogueApi.setListing(product.id, listed)
      showToast(
        listed
          ? product.approvalStatus === 'APPROVED'
            ? `${product.name} is now on the storefront.`
            : `${product.name} will go live as soon as it clears review.`
          : `${product.name} is no longer on the storefront.`,
        'success',
      )
    } catch (err: unknown) {
      setPage(previous)
      showToast(isAppError(err) ? err.message : 'Could not change this listing.', 'error')
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">My catalogue</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Everything you sell, and where each listing stands with review.
          </p>
          {/* The rule, once, in the words the product form uses. A vendor who reads only this
              line should still be able to predict what happens when they edit something. */}
          <p className="mt-1.5 max-w-2xl text-xs text-neutral-500">
            Changing what a product <span className="font-medium text-neutral-700">is</span> — its name, SKU, brand,
            description, photo, stock unit or pack — sends it back for a quick review before buyers can see it again.
            Price and stock updates go live straight away and never take a listing down.
          </p>
        </div>
        {canEditProducts && (
          <Link to="/app/products/new" className={buttonClassName('primary')}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add product
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form
          className="relative flex-1"
          onSubmit={(event) => {
            event.preventDefault()
            applySearch(query.trim())
          }}
        >
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, SKU or brand"
            aria-label="Search your catalogue"
            className="w-full rounded-md border border-neutral-200 py-2 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </form>
        <div className="flex items-center gap-1 rounded-md border border-neutral-200 bg-white p-1">
          {(['all', 'listed', 'unlisted'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={listedFilter === value}
              onClick={() => {
                setListedFilter(value)
                setPageNumber(0)
              }}
              className={`rounded px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                listedFilter === value ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {loading && result.content.length === 0 && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!loading && error && <ErrorState title="Could not load your catalogue" message={error} onRetry={refetch} />}

      {!loading && !error && result.content.length === 0 && (
        <EmptyState
          icon={PackageSearch}
          title={search || listedFilter !== 'all' ? 'Nothing matches that' : 'Your catalogue is empty'}
          description={
            search || listedFilter !== 'all'
              ? 'Try a different search, or clear the filter.'
              : 'Add a product to your inventory, then list it here to put it on the marketplace.'
          }
          action={
            canEditProducts && !search && listedFilter === 'all' ? (
              <Link to="/app/products/new" className={buttonClassName('primary')}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add product
              </Link>
            ) : undefined
          }
        />
      )}

      {result.content.length > 0 && (
        <div className={`flex flex-col gap-2 ${loading ? 'opacity-60' : ''}`}>
          {result.content.map((product) => (
            <article key={product.id} className="rounded-lg border border-neutral-200 bg-white">
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-medium text-neutral-900">{product.name}</h2>
                    <ApprovalStatusBadge status={product.approvalStatus} />
                    {!product.active && <Badge variant="neutral">Inactive</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {product.sku}
                    {product.brand ? ` · ${product.brand}` : ''} · {formatNaira(product.unitPrice)}
                    {product.unitOfMeasure ? ` per ${product.unitOfMeasure}` : ''}
                  </p>
                  {/* Three stock numbers, not one. A product with a full pallet is still
                      unsellable if every unit is committed to orders awaiting dispatch, and
                      "available" is the number the storefront actually advertises. */}
                  <p className="mt-1 text-xs text-neutral-500">
                    {product.availableToSell} available to sell
                    <span className="text-neutral-400">
                      {' '}
                      · {product.quantityOnHand} on hand · {product.committedQuantity} committed
                    </span>
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {canEditProducts && (
                    <Link
                      to={`/app/products/${product.id}/edit`}
                      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-primary-600 hover:underline"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      Edit
                    </Link>
                  )}
                  <ListingToggle
                    listed={product.listed}
                    label={product.name}
                    disabled={!canManage || togglingId === product.id}
                    disabledReason={canManage ? 'Saving…' : 'You do not have permission to change listings.'}
                    onChange={(listed) => void handleToggleListing(product, listed)}
                  />
                </div>
              </div>

              {/* The rejection panel. Rendered on approvalStatus, never on rejectionReason being
                  present: the server KEEPS the reason after a later approval, so a product that
                  was refused once and fixed would otherwise carry a red banner forever. */}
              {product.approvalStatus === 'REJECTED' && (
                <div className="flex items-start gap-3 border-t border-danger-100 bg-danger-50 px-4 py-3">
                  <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-danger-600" aria-hidden="true" />
                  <div className="text-sm text-danger-800">
                    <p className="font-medium">This listing was not approved, so buyers cannot see it.</p>
                    {product.rejectionReason && <p className="mt-0.5">{product.rejectionReason}</p>}
                    <p className="mt-1 text-danger-700">
                      Fix what it says about the product and it goes back for review automatically — there is nothing
                      else to send.
                      {canEditProducts && (
                        <>
                          {' '}
                          <Link to={`/app/products/${product.id}/edit`} className="font-medium underline">
                            Edit this listing
                          </Link>
                          .
                        </>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Listed but not yet cleared. Stated rather than left to the badge, because the
                  seller has done everything they can and the honest message is "wait". */}
              {product.approvalStatus === 'PENDING' && product.listed && (
                <div className="border-t border-warning-100 bg-warning-50 px-4 py-2.5 text-sm text-warning-800">
                  Waiting on review — buyers cannot see it yet. It goes live the moment it is approved, and you do not
                  need to do anything. You can still change the price and stock while you wait.
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <Pagination page={result.number} totalPages={result.totalPages} onPageChange={setPageNumber} />
    </div>
  )
}
