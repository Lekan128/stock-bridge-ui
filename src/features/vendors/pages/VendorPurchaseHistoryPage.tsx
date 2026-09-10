import { useState } from 'react'
import { ArrowLeft, ReceiptText } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { buttonClassName } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Pagination } from '@/components/Pagination'
import { Skeleton } from '@/components/Skeleton'
import { PurchaseHistoryCard } from '@/features/purchases/components/PurchaseHistoryCard'
import { PurchaseSourceFilter, type SourceFilter } from '@/features/purchases/components/PurchaseSourceFilter'
import { usePurchaseHistory } from '@/features/purchases/hooks/usePurchaseHistory'
import { VendorKindBadge } from '@/features/vendors/components/VendorKindBadge'
import { useVendor } from '@/features/vendors/hooks/useVendor'

/**
 * Everything this company ever bought from one supplier — `/app/vendors/:id/purchases`.
 *
 * **Its own screen, on the stakeholder's explicit instruction**, and not a section of the vendor
 * detail page. That is also the right call technically: it is paginated, so folding it in would
 * either truncate it silently or make the detail screen pay for a page nobody scrolled to.
 *
 * Merges two ledgers into one date-ordered list (see `PurchaseHistoryRepository` on the API for
 * why that merge has to happen server-side): placed marketplace orders, and manual stock-ins
 * recorded by hand against this supplier. The latter is the ONLY way an EXTERNAL supplier ever
 * shows anything here at all, since they have no seller account to place an order against. The
 * source filter lets a reader split the two apart.
 *
 * Cancelled orders appear here even though they are excluded from the spend figures on the detail
 * screen. That is not an inconsistency: "we ordered from them and pulled out" is a fact about the
 * relationship worth seeing, and it is badged with its status so nobody reads it as money spent.
 */
export function VendorPurchaseHistoryPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [source, setSource] = useState<SourceFilter>('all')
  const { detail, loading: loadingVendor, error: vendorError, refetch: refetchVendor } = useVendor(id)
  const { data, loading, error, refetch } = usePurchaseHistory({
    companyVendorId: id,
    source: source === 'all' ? undefined : source,
    page,
  })

  function handleSourceChange(next: SourceFilter) {
    setSource(next)
    setPage(0)
  }

  if (loadingVendor) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  if (vendorError || !detail) {
    return (
      <ErrorState
        title="Could not load this supplier"
        message={vendorError}
        onRetry={refetchVendor}
        action={
          <Link to="/app/vendors" className={buttonClassName('secondary')}>
            Back to suppliers
          </Link>
        }
      />
    )
  }

  const { vendor, platformVendor } = detail
  const displayName = platformVendor?.name ?? vendor.name
  const purchases = data?.content ?? []
  const filtered = source !== 'all'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="mt-0.5 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-neutral-900">Purchase history</h1>
            <VendorKindBadge kind={vendor.kind} />
          </div>
          <p className="mt-0.5 text-sm text-neutral-500">
            Everything your company has ordered or recorded from{' '}
            <Link to={`/app/vendors/${vendor.id}`} className="font-medium text-primary-600 hover:underline">
              {displayName}
            </Link>
            .
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <PurchaseSourceFilter value={source} onChange={handleSourceChange} />
      </div>

      {loading && <Skeleton className="h-64 w-full rounded-lg" />}

      {!loading && error && <ErrorState title="Could not load this purchase history" message={error} onRetry={refetch} />}

      {!loading && !error && purchases.length === 0 && (
        <EmptyState
          icon={ReceiptText}
          title={filtered ? 'Nothing matches this filter' : 'No purchases yet'}
          description={
            filtered
              ? 'Try a different filter, or view all purchases from this supplier.'
              : vendor.kind === 'EXTERNAL'
                ? // A permanent, explained empty state rather than "nothing found" — until a
                  // stock-in is recorded against this supplier, there is genuinely nothing yet.
                  'Nothing has been recorded from this supplier yet. Purchase history shows both orders placed on the marketplace and deliveries you record by hand against this supplier.'
                : 'Once you place an order with this seller, or record a delivery from them by hand, it will be listed here with what you paid.'
          }
        />
      )}

      {!loading && !error && purchases.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            {purchases.map((entry) => (
              <PurchaseHistoryCard key={entry.id} entry={entry} />
            ))}
          </div>

          <Pagination page={data?.number ?? 0} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
