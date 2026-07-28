import { useEffect, useState } from 'react'
import { Inbox, PackageSearch } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { Pagination } from '@/components/Pagination'
import { ORDER_STATUSES, PAYMENT_STATUSES, type OrderStatus, type PaymentStatus } from '@/constants/orderStatus'
import {
  OrderQueueFilters,
  type QueuePaymentFilter,
  type QueueStatusFilter,
} from '@/features/marketplace/components/OrderQueueFilters'
import { OrderQueueCard } from '@/features/marketplace/components/OrderQueueCard'
import { OrderQueueSkeleton } from '@/features/marketplace/components/OrderQueueSkeleton'
import { OrderQueueTable } from '@/features/marketplace/components/OrderQueueTable'
import { QueryErrorState } from '@/features/marketplace/components/QueryErrorState'
import { endOfDayIso, startOfDayIso } from '@/features/marketplace/formatters'
import { useAdminOrderQueue } from '@/features/marketplace/hooks/useAdminOrderQueue'
import { useOrderQueueCounts } from '@/features/marketplace/hooks/useOrderQueueCounts'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useMediaQuery } from '@/hooks/useMediaQuery'

const PAGE_SIZE = 20

/**
 * The default worklist is PLACED — orders that have been paid for or accepted and are waiting on
 * ProcurePal to do something. Opening on "everything ever sold" would put a several-hundred-row
 * historical list in front of someone whose actual question is "what came in while I was away".
 */
const DEFAULT_STATUS: QueueStatusFilter = 'PLACED'

function parseStatus(value: string | null): QueueStatusFilter {
  if (value === 'ALL') return 'ALL'
  return ORDER_STATUSES.includes(value as OrderStatus) ? (value as OrderStatus) : DEFAULT_STATUS
}

function parsePaymentStatus(value: string | null): QueuePaymentFilter {
  return PAYMENT_STATUSES.includes(value as PaymentStatus) ? (value as PaymentStatus) : 'ALL'
}

/**
 * ProcurePal's fulfilment queue — the screen its ops staff live in all day.
 *
 * Every filter is held in the query string rather than in component state, so a shift handover can
 * be a pasted URL ("here are the three Lagos orders still unpaid") and the browser's back button
 * behaves the way the operator expects.
 */
export function MarketplaceOrderQueuePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const isDesktop = useMediaQuery('(min-width: 768px)')

  const status = parseStatus(searchParams.get('status'))
  const paymentStatus = parsePaymentStatus(searchParams.get('paymentStatus'))
  const urlSearch = searchParams.get('q') ?? ''
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  const page = Math.max(0, Number(searchParams.get('page') ?? '0') || 0)

  // The text box is local so typing stays instant; the URL (and therefore the request) catches up
  // once the operator pauses.
  const [searchInput, setSearchInput] = useState(urlSearch)
  const debouncedSearch = useDebouncedValue(searchInput, 350)

  function updateParams(patch: Record<string, string | null>) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        for (const [key, value] of Object.entries(patch)) {
          if (value === null || value === '') next.delete(key)
          else next.set(key, value)
        }
        return next
      },
      // replace: true — a filter tweak is not a navigation step; going back should leave the
      // queue, not walk back through eight keystrokes.
      { replace: true },
    )
  }

  useEffect(() => {
    if (debouncedSearch === urlSearch) return
    updateParams({ q: debouncedSearch || null, page: null })
    // Reconciling the debounced box against the URL; re-running on anything else would fight the
    // operator's own edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  // Everything except `status`, shared between the table query and the pill counts so a pill's
  // number always describes the same slice of data the table is showing.
  const sharedFilters = {
    paymentStatus: paymentStatus === 'ALL' ? undefined : paymentStatus,
    q: urlSearch || undefined,
    from: startOfDayIso(from),
    to: endOfDayIso(to),
  }

  const { data, loading, error, refetch, reloadToken } = useAdminOrderQueue({
    ...sharedFilters,
    status: status === 'ALL' ? undefined : status,
    page,
    size: PAGE_SIZE,
  })
  const counts = useOrderQueueCounts(sharedFilters, reloadToken)

  const hasActiveFilters = paymentStatus !== 'ALL' || urlSearch !== '' || from !== '' || to !== ''
  const hasNarrowedStatus = status !== 'ALL'

  function resetFilters() {
    setSearchInput('')
    updateParams({ paymentStatus: null, q: null, from: null, to: null, page: null })
  }

  const orders = data?.content ?? []
  const isEmpty = !loading && !error && orders.length === 0
  // `counts.ALL` is the same query without the status narrowing, so zero there with no filters set
  // is the real "ProcurePal has never sold anything" — a different situation, and a different
  // message, from "nothing matches what you asked for".
  const nothingAtAll = isEmpty && !hasActiveFilters && counts.ALL === 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Order queue</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Customer orders to confirm, prepare and dispatch. New orders are flagged in amber.
          </p>
        </div>
        {data && !error && (
          <p aria-live="polite" className="text-sm text-neutral-500">
            {data.totalElements} order{data.totalElements === 1 ? '' : 's'} in this view
          </p>
        )}
      </div>

      <OrderQueueFilters
        status={status}
        onStatusChange={(next) => updateParams({ status: next, page: null })}
        counts={counts}
        paymentStatus={paymentStatus}
        onPaymentStatusChange={(next) => updateParams({ paymentStatus: next === 'ALL' ? null : next, page: null })}
        search={searchInput}
        onSearchChange={setSearchInput}
        from={from}
        to={to}
        onDateRangeChange={(range) => updateParams({ from: range.from || null, to: range.to || null, page: null })}
        hasActiveFilters={hasActiveFilters}
        onReset={resetFilters}
        onRefresh={refetch}
        refreshing={loading}
      />

      {loading && <OrderQueueSkeleton desktop={isDesktop} />}

      {!loading && error && (
        <QueryErrorState title="The order queue could not be loaded" message={error} onRetry={refetch} />
      )}

      {nothingAtAll && (
        <EmptyState
          icon={Inbox}
          title="No orders yet"
          description="Once a company checks out on the storefront, their order lands here for confirmation, picking and dispatch."
        />
      )}

      {isEmpty && !nothingAtAll && (
        <EmptyState
          icon={PackageSearch}
          tone="positive"
          title="Nothing in this worklist"
          description={
            hasActiveFilters
              ? 'No orders match the filters you have set. Clear them to see the rest of the queue.'
              : 'Nothing is waiting here right now. Try another status, or look at every order.'
          }
          action={
            <>
              {hasActiveFilters && (
                <Button variant="secondary" onClick={resetFilters}>
                  Clear filters
                </Button>
              )}
              {hasNarrowedStatus && (
                <Button variant="secondary" onClick={() => updateParams({ status: 'ALL', page: null })}>
                  View all orders
                </Button>
              )}
            </>
          }
        />
      )}

      {!loading && !error && orders.length > 0 && (
        <>
          {isDesktop ? (
            <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
              <OrderQueueTable orders={orders} />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {orders.map((order) => (
                <OrderQueueCard key={order.id} order={order} />
              ))}
            </div>
          )}

          {data && (
            <Pagination
              page={data.number}
              totalPages={data.totalPages}
              onPageChange={(next) => updateParams({ page: String(next) })}
            />
          )}
        </>
      )}
    </div>
  )
}
