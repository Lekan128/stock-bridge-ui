import { useState } from 'react'
import { ReceiptText } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Pagination } from '@/components/Pagination'
import { Skeleton } from '@/components/Skeleton'
import { PurchaseHistoryCard } from '@/features/purchases/components/PurchaseHistoryCard'
import { PurchaseSourceFilter, type SourceFilter } from '@/features/purchases/components/PurchaseSourceFilter'
import { usePurchaseHistory } from '@/features/purchases/hooks/usePurchaseHistory'
import { useVendors } from '@/features/vendors/hooks/useVendors'

/** `2026-07-27` → the first millisecond of that local day. */
function startOfDayIso(date: string): string | undefined {
  if (!date) return undefined
  const parsed = new Date(`${date}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

/** `2026-07-27` → the last millisecond of that local day, so "to: today" includes today. */
function endOfDayIso(date: string): string | undefined {
  if (!date) return undefined
  const parsed = new Date(`${date}T23:59:59.999`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

/**
 * Everything this company has ever bought, from every supplier — `/app/purchases`.
 *
 * The company-wide screen above the per-vendor one at `/app/vendors/:id/purchases`. Same data,
 * same merge of the two ledgers (placed marketplace orders and manual stock-ins), just without a
 * `companyVendorId` filter — the supplier filter below is exactly that same narrowing, offered as
 * a control instead of being fixed by the route.
 */
export function PurchaseHistoryPage() {
  const [page, setPage] = useState(0)
  const [source, setSource] = useState<SourceFilter>('all')
  const [companyVendorId, setCompanyVendorId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const { data: vendorsPage } = useVendors({ size: 200 })
  const vendors = vendorsPage?.content ?? []

  const { data, loading, error, refetch } = usePurchaseHistory({
    companyVendorId: companyVendorId || undefined,
    source: source === 'all' ? undefined : source,
    from: startOfDayIso(from),
    to: endOfDayIso(to),
    page,
  })

  const purchases = data?.content ?? []
  const filtered = source !== 'all' || companyVendorId !== '' || from !== '' || to !== ''

  function resetPage() {
    setPage(0)
  }

  function clearFilters() {
    setSource('all')
    setCompanyVendorId('')
    setFrom('')
    setTo('')
    setPage(0)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Purchase history</h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          Everything your company has bought — every supplier, every order placed on the
          marketplace, and every delivery you have recorded by hand.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <label htmlFor="purchases-vendor" className="mb-1.5 block text-xs font-medium text-neutral-500">
              Supplier
            </label>
            <select
              id="purchases-vendor"
              value={companyVendorId}
              onChange={(event) => {
                setCompanyVendorId(event.target.value)
                resetPage()
              }}
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
            >
              <option value="">All suppliers</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="purchases-from" className="mb-1.5 block text-xs font-medium text-neutral-500">
              From
            </label>
            <input
              id="purchases-from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => {
                setFrom(event.target.value)
                resetPage()
              }}
              className="rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="purchases-to" className="mb-1.5 block text-xs font-medium text-neutral-500">
              To
            </label>
            <input
              id="purchases-to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => {
                setTo(event.target.value)
                resetPage()
              }}
              className="rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
            />
          </div>

          <PurchaseSourceFilter
            value={source}
            onChange={(next) => {
              setSource(next)
              resetPage()
            }}
          />

          {filtered && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-medium text-primary-600 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {loading && <Skeleton className="h-64 w-full rounded-lg" />}

      {!loading && error && <ErrorState title="Could not load your purchase history" message={error} onRetry={refetch} />}

      {!loading && !error && purchases.length === 0 && (
        <EmptyState
          icon={ReceiptText}
          title={filtered ? 'Nothing matches these filters' : 'No purchases yet'}
          description={
            filtered
              ? 'Try a wider date range or a different supplier and source.'
              : 'Once you place an order on the marketplace, or record a delivery by hand against a supplier, it will be listed here.'
          }
          action={
            filtered ? (
              <button type="button" onClick={clearFilters} className="text-sm font-medium text-primary-600 hover:underline">
                Clear filters
              </button>
            ) : undefined
          }
        />
      )}

      {!loading && !error && purchases.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            {purchases.map((entry) => (
              <PurchaseHistoryCard key={entry.id} entry={entry} showVendor />
            ))}
          </div>

          <Pagination page={data?.number ?? 0} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
