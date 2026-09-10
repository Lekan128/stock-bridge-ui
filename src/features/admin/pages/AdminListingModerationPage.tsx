import { useState } from 'react'
import { Check, PackageSearch, ShieldCheck, Store, X } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Pagination } from '@/components/Pagination'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/components/useToast'
import { superAdminApiClient } from '@/features/admin/api/superAdminApi'
import { RejectListingDialog } from '@/features/admin/components/RejectListingDialog'
import { useModerationQueue } from '@/features/admin/hooks/useModerationQueue'
import type { ModerationProduct, ProductApprovalStatus } from '@/features/admin/types'
import { ProductImage } from '@/features/products/components/ProductImage'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { isAppError } from '@/types/api'
import { formatDateTime } from '@/features/marketplace/formatters'
import { formatNaira } from '@/utils/money'

const PAGE_SIZE = 20

type Tab = ProductApprovalStatus | 'ALL'

const TABS: { key: Tab; label: string }[] = [
  { key: 'PENDING', label: 'Awaiting review' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'ALL', label: 'All' },
]

/**
 * Listing moderation — route `/admin/listings`.
 *
 * <h2>What this screen is for</h2>
 * A vendor's listing is something a real buying company will turn into a real purchase order.
 * VENDOR_RESEARCH.md Section C item 4 is blunt about skipping the gate: the first mis-priced or
 * fake listing is somebody's actual order. This is the minimum viable version that document asks
 * for — a queue, an approve, a reject with a reason, and a resubmission loop.
 *
 * <h2>ProcurePal is deliberately absent from this queue</h2>
 * The platform owner's own products are auto-approved server-side. Moderation exists so the
 * platform can vouch for a THIRD PARTY before a buyer commits; the platform vouching for itself
 * is a no-op that would only ever mean ProcurePal's catalogue silently stopped rendering because
 * nobody cleared the queue.
 *
 * <h2>Approving does not publish</h2>
 * Approval is the platform saying "this may be sold"; listing is the seller saying "sell it". The
 * two flags stay separate and both are required, so approving a draft the vendor has not submitted
 * does not push it live. The "Not yet submitted" badge is what tells a reviewer which is which.
 */
export function AdminListingModerationPage() {
  const { showToast } = useToast()
  const [tab, setTab] = useState<Tab>('PENDING')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [rejectTarget, setRejectTarget] = useState<ModerationProduct | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)

  const debouncedSearch = useDebouncedValue(search, 350)

  const { data, products, counts, loading, error, refetch } = useModerationQueue({
    status: tab === 'ALL' ? undefined : tab,
    all: tab === 'ALL' || undefined,
    q: debouncedSearch || undefined,
    page,
    size: PAGE_SIZE,
  })

  function switchTab(next: Tab) {
    setTab(next)
    // Page 7 of "pending" is never a meaningful position in "rejected"; landing on an empty page
    // reads as a bug.
    setPage(0)
  }

  async function handleApprove(product: ModerationProduct) {
    setBusyId(product.id)
    try {
      await superAdminApiClient.approveListing(product.id)
      showToast(`“${product.name}” approved.`, 'success')
      refetch()
    } catch (err: unknown) {
      showToast(isAppError(err) ? err.message : 'We could not approve that listing.', 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject(reason: string) {
    if (!rejectTarget) return
    setRejecting(true)
    try {
      await superAdminApiClient.rejectListing(rejectTarget.id, reason)
      showToast(`“${rejectTarget.name}” rejected. The seller can fix it and resubmit.`, 'success')
      setRejectTarget(null)
      refetch()
    } catch (err: unknown) {
      showToast(isAppError(err) ? err.message : 'We could not reject that listing.', 'error')
    } finally {
      setRejecting(false)
    }
  }

  const totalPages = data?.totalPages ?? 0
  const showSkeleton = loading && !data

  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-neutral-900">
            <ShieldCheck className="h-5 w-5 text-primary-600" aria-hidden="true" />
            Listing moderation
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            Vendors' products wait here before buyers can order them. ProcurePal's own catalogue is
            approved automatically and never appears in this queue.
          </p>
        </div>
        {counts && (
          <div className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-center">
            <p className="text-2xl font-bold text-neutral-900">{counts.awaitingReview}</p>
            {/* Submitted-and-waiting, not raw PENDING — a vendor's unsubmitted draft is nobody's
                backlog, and a badge that counted drafts would never reach zero. */}
            <p className="text-xs text-neutral-500">waiting on you</p>
          </div>
        )}
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg border border-neutral-200 bg-white p-1">
          {TABS.map((entry) => {
            const count =
              entry.key === 'PENDING'
                ? counts?.pending
                : entry.key === 'APPROVED'
                  ? counts?.approved
                  : entry.key === 'REJECTED'
                    ? counts?.rejected
                    : undefined
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => switchTab(entry.key)}
                aria-current={tab === entry.key ? 'page' : undefined}
                className={`rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                  tab === entry.key
                    ? 'bg-primary-600 text-white'
                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                }`}
              >
                {entry.label}
                {count !== undefined && <span className="ml-1.5 text-xs opacity-75">{count}</span>}
              </button>
            )
          })}
        </div>

        <input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(0)
          }}
          placeholder="Search name, SKU or brand…"
          aria-label="Search listings"
          className="min-w-56 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      <div className="mt-4">
        {error && (
          <ErrorState
            variant={products.length > 0 ? 'inline' : 'block'}
            title="We could not load the moderation queue"
            message={error}
            onRetry={refetch}
            className={products.length > 0 ? 'mb-4' : ''}
          />
        )}

        {showSkeleton && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        )}

        {!showSkeleton && products.length > 0 && (
          <>
            <ul className={`space-y-3 transition-opacity ${loading ? 'opacity-50' : ''}`}>
              {products.map((product) => (
                <li
                  key={product.id}
                  className="flex flex-wrap items-start gap-4 rounded-lg border border-neutral-200 bg-white p-4"
                >
                  <ProductImage
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-20 w-20 shrink-0 rounded-md"
                    iconClassName="h-6 w-6"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-semibold text-neutral-900">{product.name}</h2>
                      {product.approvalStatus === 'PENDING' && <Badge variant="warning">Pending</Badge>}
                      {product.approvalStatus === 'APPROVED' && <Badge variant="success">Approved</Badge>}
                      {product.approvalStatus === 'REJECTED' && <Badge variant="danger">Rejected</Badge>}
                      {/* The distinction that decides whether anyone is actually blocked. */}
                      {!product.marketplaceListed && <Badge variant="neutral">Not yet submitted</Badge>}
                    </div>

                    <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
                      <Store className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{product.sellerName ?? 'Unknown seller'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{product.sku}</span>
                    </p>

                    <p className="mt-1 text-sm font-medium text-neutral-900">
                      {formatNaira(product.unitPrice)}
                      {product.unitOfMeasure && (
                        <span className="font-normal text-neutral-500"> per {product.unitOfMeasure}</span>
                      )}
                    </p>

                    {product.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-neutral-600">{product.description}</p>
                    )}

                    {/* Kept visible after a later approval too — the history of a contested listing
                        is the useful part when it comes round a second time. */}
                    {product.rejectionReason && (
                      <p className="mt-2 rounded-md bg-danger-50 px-2.5 py-1.5 text-xs text-danger-800">
                        <span className="font-semibold">Last rejection: </span>
                        {product.rejectionReason}
                      </p>
                    )}

                    <p className="mt-2 text-xs text-neutral-400">
                      Submitted {formatDateTime(product.createdAt)}
                      {product.reviewedAt && ` · last reviewed ${formatDateTime(product.reviewedAt)}`}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {product.approvalStatus !== 'APPROVED' && (
                      <Button
                        variant="primary"
                        onClick={() => void handleApprove(product)}
                        loading={busyId === product.id}
                        disabled={busyId !== null}
                      >
                        <Check className="h-4 w-4" aria-hidden="true" />
                        Approve
                      </Button>
                    )}
                    {product.approvalStatus !== 'REJECTED' && (
                      <Button variant="secondary" onClick={() => setRejectTarget(product)} disabled={busyId !== null}>
                        <X className="h-4 w-4" aria-hidden="true" />
                        Reject
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-6" />
          </>
        )}

        {!showSkeleton && !error && products.length === 0 && (
          <EmptyState
            icon={PackageSearch}
            title={tab === 'PENDING' ? 'Nothing waiting for review' : 'Nothing here'}
            description={
              debouncedSearch
                ? `No listings match “${debouncedSearch}”.`
                : tab === 'PENDING'
                  ? 'Every vendor listing has been reviewed. New submissions will appear here.'
                  : 'No listings in this state yet.'
            }
          />
        )}
      </div>

      <RejectListingDialog
        product={rejectTarget}
        submitting={rejecting}
        onCancel={() => setRejectTarget(null)}
        onConfirm={(reason) => void handleReject(reason)}
      />
    </div>
  )
}
