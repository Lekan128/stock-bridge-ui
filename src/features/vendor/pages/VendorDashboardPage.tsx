import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Banknote,
  ClipboardList,
  ClockAlert,
  HandCoins,
  PackageSearch,
  ShieldQuestion,
} from 'lucide-react'
import { StatCard } from '@/components/analytics/StatCard'
import { defaultDateRange, toApiDateTime } from '@/components/analytics/dateRange'
import { formatDateRange, formatNumber } from '@/components/analytics/formatters'
import { SummaryCardsSkeleton } from '@/components/analytics/SummaryCardsSkeleton'
import { buttonClassName } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import { Skeleton } from '@/components/Skeleton'
import { useAdminOrderQueue } from '@/features/marketplace/hooks/useAdminOrderQueue'
import { ApprovalStatusBadge } from '@/features/vendor/components/ApprovalStatusBadge'
import { useVendorCatalogue } from '@/features/vendor/hooks/useVendorCatalogue'
import { useVendorSalesSummary, useVendorStockOuts } from '@/features/vendor/hooks/useVendorSales'
import { formatNaira } from '@/utils/money'

const NEEDS_ACTION_LIMIT = 5
const STOCK_OUT_LIMIT = 5
const MODERATION_LIMIT = 5

/**
 * The seller's home screen — what `/app` renders instead of the buying dashboard when the
 * account sells and cannot buy.
 *
 * <h2>Why the buyer dashboard could not just be reused</h2>
 * It answers a purchaser's questions: what is running low in MY store, what did I spend, what
 * is arriving. A vendor's are the mirror image — who is waiting on me, what am I owed, what
 * have I run out of, and which of my listings is invisible and why. Showing a seller a screen
 * about buying is not merely unhelpful; it is the clearest signal that the app does not know
 * what kind of account they are.
 *
 * <h2>Four panels, chosen for what a single-user vendor loses by not looking</h2>
 * Orders needing action first, because an unshipped order is the failure that damages buyer
 * trust fastest (VENDOR_RESEARCH.md Section C item 8). Then revenue, then stock-outs — Jumia's
 * dominant cancellation cause, per Section C item 10 — then listings stuck in moderation,
 * which is the one problem a vendor cannot diagnose from anywhere else in the app.
 *
 * <h2>Composed from existing hooks, with no new endpoint</h2>
 * The queue, the sales summary, the stock-outs and the catalogue all already have hooks that
 * are scoped server-side to the caller. A dedicated "dashboard" endpoint would be a fifth
 * definition of the same four numbers, free to disagree with the screens they link to.
 */
export function VendorDashboardPage() {
  // Month-to-date, the same default every analytics surface in the app opens on. Computed once
  // per render rather than held in state: this screen has no date control, so there is nothing
  // for state to remember, and the figures should follow the calendar without a reload.
  const range = defaultDateRange()
  const params = { from: toApiDateTime(range.from), to: toApiDateTime(range.to) }

  const summary = useVendorSalesSummary(params)
  // The default queue view: newest first, unfiltered. The server scopes it to this seller,
  // so "orders" here already means "orders placed with me".
  const queue = useAdminOrderQueue({ size: NEEDS_ACTION_LIMIT })
  const stockOuts = useVendorStockOuts(STOCK_OUT_LIMIT)
  // Listed products are asked for rather than the whole catalogue: a listing stuck in review
  // matters because it is switched ON and still invisible. An unlisted draft is not a problem.
  const catalogue = useVendorCatalogue({ listed: true, page: 0, size: 50 })

  const current = summary.data?.current
  const awaitingReview = catalogue.page.content.filter((product) => product.approvalStatus !== 'APPROVED')
  const orders = queue.data?.content ?? []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Your shop</h1>
        <p className="text-sm text-neutral-500">
          Orders waiting on you, what you have earned, and anything stopping a sale.
        </p>
      </div>

      {summary.loading && !summary.data && <SummaryCardsSkeleton />}
      {summary.error && !summary.data && (
        <ErrorState title="Could not load your sales figures" message={summary.error} onRetry={summary.refetch} />
      )}

      {current && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="To fulfil"
            value={formatNumber(current.outstandingOrderCount)}
            subtitle={formatNaira(current.outstandingOrderValue)}
            icon={ClipboardList}
            variant={current.outstandingOrderCount > 0 ? 'warning' : 'default'}
            href="/app/marketplace/orders"
          />
          <StatCard
            label="Revenue"
            value={formatNaira(current.grossRevenue)}
            subtitle={formatDateRange(range.from, range.to)}
            icon={Banknote}
            href="/app/selling/analytics"
          />
          <StatCard
            label="Cash owed to you"
            value={formatNaira(current.payOnDeliveryExposure)}
            subtitle="Pay-on-delivery, not yet settled"
            icon={HandCoins}
          />
          <StatCard
            label="Cancelled"
            value={formatNumber(current.cancelledOrderCount)}
            subtitle={formatNaira(current.cancelledOrderValue)}
            icon={AlertTriangle}
            variant={current.cancelledOrderCount > 0 ? 'warning' : 'default'}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-neutral-900">Recent orders</h2>
            <Link to="/app/marketplace/orders" className="text-sm font-medium text-primary-600 hover:underline">
              Open the queue
            </Link>
          </div>

          {queue.loading && !queue.data && (
            <div className="mt-4 flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full rounded-md" />
              ))}
            </div>
          )}
          {queue.error && !queue.data && (
            <ErrorState message={queue.error} onRetry={queue.refetch} variant="inline" className="mt-4" />
          )}
          {queue.data && orders.length === 0 && (
            <EmptyState
              className="mt-2"
              icon={ClockAlert}
              tone="positive"
              title="Nothing waiting on you"
              description="New orders placed with you will appear here."
            />
          )}
          {orders.length > 0 && (
            <ul className="mt-2 flex flex-col divide-y divide-neutral-100">
              {orders.map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link
                      to={`/app/marketplace/orders/${order.id}`}
                      className="text-sm font-medium text-neutral-900 hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                    <p className="truncate text-xs text-neutral-500">{order.customer?.name ?? 'Customer'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <OrderStatusBadge status={order.status} showIcon={false} />
                    <span className="text-sm font-semibold tabular-nums text-neutral-900">
                      {formatNaira(order.total)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-neutral-900">Out of stock</h2>
            <Link to="/app/products" className="text-sm font-medium text-primary-600 hover:underline">
              Inventory
            </Link>
          </div>

          {stockOuts.loading && !stockOuts.data && (
            <div className="mt-4 flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full rounded-md" />
              ))}
            </div>
          )}
          {stockOuts.error && !stockOuts.data && (
            <ErrorState message={stockOuts.error} onRetry={stockOuts.refetch} variant="inline" className="mt-4" />
          )}
          {stockOuts.data?.length === 0 && (
            <EmptyState
              className="mt-2"
              icon={PackageSearch}
              tone="positive"
              title="Everything you list is in stock"
              description="A product buyers cannot order is the fastest way to lose one, so this is worth keeping empty."
            />
          )}
          {stockOuts.data && stockOuts.data.length > 0 && (
            <ul className="mt-2 flex flex-col divide-y divide-neutral-100">
              {stockOuts.data.map((product) => (
                <li key={product.productId} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link
                      to={`/app/products/${product.productId}`}
                      className="truncate text-sm font-medium text-neutral-900 hover:underline"
                    >
                      {product.name}
                    </Link>
                    <p className="truncate text-xs text-neutral-500">
                      {product.listed ? 'On the storefront' : 'Not listed'}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-semibold tabular-nums ${
                      product.availableToSell === 0 ? 'text-danger-600' : 'text-warning-700'
                    }`}
                  >
                    {product.availableToSell} left
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* The panel a vendor cannot get anywhere else. A listing that is switched ON and still
          invisible has exactly one explanation, and without this the question arrives as a
          support ticket instead. */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-neutral-900">Listings not yet on the storefront</h2>
          <Link to="/app/selling/catalogue" className="text-sm font-medium text-primary-600 hover:underline">
            My catalogue
          </Link>
        </div>

        {catalogue.loading && catalogue.page.content.length === 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-md" />
            ))}
          </div>
        )}
        {catalogue.error && (
          <ErrorState message={catalogue.error} onRetry={catalogue.refetch} variant="inline" className="mt-4" />
        )}
        {!catalogue.loading && !catalogue.error && awaitingReview.length === 0 && (
          <EmptyState
            className="mt-2"
            icon={ShieldQuestion}
            tone="positive"
            title="Every listing you switched on is live"
            description="New products are reviewed before buyers can see them. Anything still waiting will show up here."
          />
        )}
        {awaitingReview.length > 0 && (
          <ul className="mt-2 flex flex-col divide-y divide-neutral-100">
            {awaitingReview.slice(0, MODERATION_LIMIT).map((product) => (
              <li key={product.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900">{product.name}</p>
                  {product.approvalStatus === 'REJECTED' ? (
                    <p className="text-xs text-danger-700">
                      {product.rejectionReason ?? 'Not approved.'}{' '}
                      <Link to="/app/selling/catalogue" className="font-medium underline">
                        Fix and resubmit
                      </Link>
                    </p>
                  ) : (
                    <p className="text-xs text-neutral-500">
                      Waiting on review — it goes live automatically once approved.
                    </p>
                  )}
                </div>
                <ApprovalStatusBadge status={product.approvalStatus} />
              </li>
            ))}
          </ul>
        )}
        {awaitingReview.length > MODERATION_LIMIT && (
          <Link to="/app/selling/catalogue" className={`mt-4 ${buttonClassName('secondary')}`}>
            See all {awaitingReview.length}
          </Link>
        )}
      </section>
    </div>
  )
}
