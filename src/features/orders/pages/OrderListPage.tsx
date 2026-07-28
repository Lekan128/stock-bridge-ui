import { useCallback, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { buttonClassName } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { Pagination } from '@/components/Pagination'
import { ORDER_STATUSES, type OrderStatus } from '@/constants/orderStatus'
import { AwaitingReceiptCallout } from '@/features/orders/components/AwaitingReceiptCallout'
import { EmptyOrdersState } from '@/features/orders/components/EmptyOrdersState'
import { OrderListSkeleton } from '@/features/orders/components/OrderListSkeleton'
import { OrderRowCard } from '@/features/orders/components/OrderRowCard'
import { OrderStatusFilter } from '@/features/orders/components/OrderStatusFilter'
import { OrderTable } from '@/features/orders/components/OrderTable'
import { useAwaitingReceiptCount } from '@/features/orders/hooks/useAwaitingReceiptCount'
import { useOrders } from '@/features/orders/hooks/useOrders'
import { useRetryPayment } from '@/features/orders/hooks/useRetryPayment'

const PAGE_SIZE = 20

/** Guards the query string: `?status=nonsense` must not be forwarded to the API as a bad enum. */
function parseStatus(raw: string | null): OrderStatus | undefined {
  if (!raw) return undefined
  return (ORDER_STATUSES as readonly string[]).includes(raw) ? (raw as OrderStatus) : undefined
}

/**
 * The buyer's purchase history — `/app/orders`.
 *
 * Filter and page live in the query string, so a view is shareable and the browser back button
 * steps through filters the way people expect (UX bar §7).
 *
 * The one thing this page must not let a buyer miss: a delivered order they have not confirmed.
 * Until they do, the goods sit in their inventory as incoming stock and cannot be used — so the
 * count is hoisted into a callout and the rows themselves are tinted.
 */
export function OrderListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const status = parseStatus(searchParams.get('status'))
  const pageParam = Number(searchParams.get('page') ?? '0')
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 0

  const params = useMemo(() => ({ status, page, size: PAGE_SIZE }), [status, page])
  const { data, loading, error, refetch } = useOrders(params)
  const { count: awaitingReceipt } = useAwaitingReceiptCount()
  const { retry, pendingOrderId } = useRetryPayment()

  const updateParams = useCallback(
    (next: { status?: OrderStatus; page?: number }) => {
      const updated = new URLSearchParams(searchParams)
      if (next.status === undefined) updated.delete('status')
      else updated.set('status', next.status)
      if (!next.page) updated.delete('page')
      else updated.set('page', String(next.page))
      setSearchParams(updated, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const handleStatusChange = useCallback(
    (next?: OrderStatus) => updateParams({ status: next, page: 0 }),
    [updateParams],
  )

  const handlePageChange = useCallback(
    (next: number) => {
      updateParams({ status, page: next })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [status, updateParams],
  )

  const orders = data?.content ?? []
  const showEmpty = !loading && !error && orders.length === 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">My orders</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Everything your company has bought from ProcurePal, and where each order has got to.
          </p>
        </div>
        <Link to="/" className={buttonClassName('secondary')}>
          Browse catalog
        </Link>
      </div>

      <AwaitingReceiptCallout
        count={awaitingReceipt}
        filterActive={status === 'DELIVERED'}
        onShowDelivered={() => handleStatusChange('DELIVERED')}
      />

      <OrderStatusFilter value={status} onChange={handleStatusChange} />

      {loading && <OrderListSkeleton />}

      {!loading && error && (
        <ErrorState
          title="Could not load your orders"
          message={error}
          onRetry={refetch}
          action={
            <Link to="/" className={buttonClassName('secondary')}>
              Browse the catalog
            </Link>
          }
        />
      )}

      {showEmpty && <EmptyOrdersState status={status} onClearFilter={() => handleStatusChange(undefined)} />}

      {!loading && !error && orders.length > 0 && data && (
        <>
          <div className="flex flex-col gap-2 md:hidden">
            {orders.map((order) => (
              <OrderRowCard
                key={order.id}
                order={order}
                onRetryPayment={(id) => void retry(id)}
                retrying={pendingOrderId === order.id}
              />
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-lg border border-neutral-200 bg-white md:block">
            <OrderTable orders={orders} onRetryPayment={(id) => void retry(id)} retryingOrderId={pendingOrderId} />
          </div>
          <Pagination page={data.number} totalPages={data.totalPages} onPageChange={handlePageChange} />
        </>
      )}
    </div>
  )
}
