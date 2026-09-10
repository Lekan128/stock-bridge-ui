import { useEffect, useState } from 'react'
import {
  ArrowRight,
  CircleCheck,
  Clock,
  CreditCard,
  MapPin,
  PackageSearch,
  Phone,
  Store,
  Truck,
  Warehouse,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Button, buttonClassName } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/components/useToast'
import { hasIncomingStock, PAYMENT_METHOD_LABELS } from '@/constants/orderStatus'
import { checkoutApi } from '@/features/checkout/api/checkoutApi'
import { useOrder } from '@/features/checkout/hooks/useOrder'
import { paymentHandoff } from '@/features/checkout/paymentHandoff'
import { ProductImage } from '@/features/products/components/ProductImage'
import { useMarketplaceSettings } from '@/features/storefront/hooks/useMarketplaceSettings'
import { isAppError } from '@/types/api'
import { formatNaira } from '@/utils/money'
import { formatPerUnit, formatQuantity } from '@/utils/units'

function formatDateTime(value?: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * Post-purchase confirmation — route `/order-confirmation/:orderId`.
 *
 * The single most important thing on this screen is not the receipt: it is the explanation that
 * the goods are already in the buyer's own inventory as *incoming* stock and only become usable
 * when they confirm receipt. That link between buying here and their stock records is the entire
 * point of ProcurePal, and if a first-time buyer leaves this page without understanding it, the
 * product has failed to explain itself.
 */
export function OrderConfirmationPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const { order, loading, error, notFound, refetch } = useOrder(orderId)
  const { settings } = useMarketplaceSettings()
  const { showToast } = useToast()
  const [payingNow, setPayingNow] = useState(false)

  // Arriving here means the checkout hand-off is over, however it ended.
  useEffect(() => {
    paymentHandoff.clear()
  }, [])

  /** Fresh transaction every time — the previous `checkoutUrl` expires after 40 minutes. */
  async function handlePayNow() {
    if (!order) return
    setPayingNow(true)
    try {
      const payment = await checkoutApi.initializePayment(order.id)
      paymentHandoff.write({
        paymentReference: payment.paymentReference,
        orderId: order.id,
        orderNumber: order.orderNumber,
      })
      window.location.assign(payment.checkoutUrl)
    } catch (err) {
      const status = isAppError(err) ? err.status : 0
      if (status === 409) {
        showToast('This order has already been paid for.', 'info')
        refetch()
      } else if (status === 503) {
        showToast('Online payment is unavailable right now. Please try again shortly.', 'error')
      } else {
        showToast(isAppError(err) ? err.message : 'We could not open the payment page.', 'error')
      }
      setPayingNow(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="mt-4 h-40 w-full rounded-lg" />
        <Skeleton className="mt-4 h-56 w-full rounded-lg" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <EmptyState
          icon={PackageSearch}
          title="We could not find that order"
          description="It may belong to another company, or the link may be out of date. All of your company's orders are listed in your workspace."
          action={
            <Link to="/app/orders" className={buttonClassName('primary')}>
              View your orders
            </Link>
          }
        />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <ErrorState
          title="We could not load your order"
          message={error}
          onRetry={refetch}
          action={
            <Link to="/app/orders" className={buttonClassName('secondary')}>
              View your orders
            </Link>
          }
        />
      </div>
    )
  }

  const awaitingPayment = order.status === 'PENDING_PAYMENT'
  const incomingCreated = hasIncomingStock(order.status)
  const delivery = order.delivery ?? {}
  // Siblings are the OTHER orders from this checkout, so the trip is one larger than the list.
  const orderCount = (order.siblingOrders?.length ?? 0) + 1
  const isSplit = orderCount > 1
  const addressLines = [delivery.addressLine1, delivery.addressLine2, delivery.city, delivery.state]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      {/* The banner states the outcome plainly. A Monnify order that has not been paid for is NOT
          a confirmed purchase, and saying "thank you for your order" over an unpaid one is how
          buyers end up believing goods are on the way when nothing has been committed. */}
      <div
        className={`rounded-lg border p-5 ${awaitingPayment ? 'border-warning-200 bg-warning-50' : 'border-accent-200 bg-accent-50'}`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              awaitingPayment ? 'bg-warning-100 text-warning-700' : 'bg-accent-100 text-accent-700'
            }`}
          >
            {awaitingPayment ? (
              <Clock className="h-5 w-5" aria-hidden="true" />
            ) : (
              <CircleCheck className="h-5 w-5" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-neutral-900 sm:text-xl">
              {awaitingPayment
                ? isSplit
                  ? `Your ${orderCount} orders are waiting for payment`
                  : 'Your order is waiting for payment'
                : isSplit
                  ? `${orderCount} orders placed — thank you`
                  : 'Order placed — thank you'}
            </h1>
            <p className="mt-1 text-sm text-neutral-700">
              {awaitingPayment
                ? isSplit
                  ? `We have reserved nothing yet. One payment covers all ${orderCount} orders — complete it and each seller will start preparing their part.`
                  : 'We have reserved nothing yet. Complete the payment and ProcurePal will start preparing your order.'
                : isSplit
                  ? `Each seller has their part of your basket and will confirm shortly. Everything you need is on this page and in your orders list — nothing else to do for now.`
                  : 'ProcurePal has your order and will confirm it shortly. Everything you need is on this page and in your orders list — nothing else to do for now.'}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-neutral-200 bg-white px-2 py-1 font-mono text-xs font-medium text-neutral-700">
                {order.orderNumber}
              </span>
              <OrderStatusBadge status={order.status} />
              <PaymentStatusBadge status={order.paymentStatus} />
            </div>
          </div>
        </div>

        {awaitingPayment && order.paymentMethod === 'MONNIFY' && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => void handlePayNow()} loading={payingNow}>
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              Pay {formatNaira(order.total)} now
            </Button>
            <Link to={`/app/orders/${order.id}`} className={buttonClassName('secondary')}>
              Manage this order
            </Link>
          </div>
        )}
      </div>

      {/* THE SPLIT, EXPLAINED.

          A buyer who checked out one basket and got three order numbers will assume something went
          wrong unless this says otherwise, in those words, above the fold. Two facts do the work:
          that it was ONE payment, and that each order is delivered separately - which is also why
          each one carried its own delivery fee on the previous screen.

          Placed before the incoming-stock panel deliberately: "why are there three of these"
          has to be answered before anything else on the page will make sense. */}
      {isSplit && (
        <section className="mt-5 rounded-lg border border-primary-200 bg-primary-50 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
            <Store className="h-5 w-5 text-primary-600" aria-hidden="true" />
            Your basket became {orderCount} orders
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-700">
            Your items came from {orderCount} different sellers, so we split them into one order per
            seller — each is prepared, delivered and tracked on its own.{' '}
            <strong className="font-semibold">You paid once</strong>, for all of them together.
          </p>

          <ul className="mt-3 space-y-2">
            {[
              { id: order.id, orderNumber: order.orderNumber, seller: order.seller, total: order.total, current: true },
              ...order.siblingOrders.map((sibling) => ({ ...sibling, current: false })),
            ].map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary-200 bg-white px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900">
                    {entry.seller?.name ?? 'Unknown seller'}
                    {entry.current && <span className="ml-2 text-xs font-normal text-neutral-400">(this page)</span>}
                  </p>
                  <p className="font-mono text-xs text-neutral-500">{entry.orderNumber}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold text-neutral-900">{formatNaira(entry.total)}</span>
                  {!entry.current && (
                    <Link
                      to={`/order-confirmation/${entry.id}`}
                      className="rounded text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      View
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The point of the whole flow. Deliberately near the top and not buried under the receipt. */}
      <section className="mt-5 rounded-lg border border-warning-200 bg-white p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
          <Warehouse className="h-5 w-5 text-warning-600" aria-hidden="true" />
          What this does to your stock
        </h2>
        {incomingCreated ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-neutral-700">
              These {order.itemCount} units are already showing in your own inventory as{' '}
              <strong className="font-semibold text-warning-800">incoming stock</strong>. Incoming stock is visible to
              your whole team and counts towards what you have on order — but it is deliberately{' '}
              <strong className="font-semibold">not usable stock</strong>, so nobody can sell or consume goods that are
              still on a truck.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-neutral-700">
              When the delivery arrives, open this order and confirm what you received. At that moment the incoming
              quantity converts into real on-hand stock, and your stock levels are correct without anyone re-keying a
              single line.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-neutral-700">
            Nothing has been added to your inventory yet. As soon as this payment clears, these {order.itemCount} units
            appear in your stock as <strong className="font-semibold text-warning-800">incoming stock</strong> — visible
            but not yet usable — and become real on-hand stock when you confirm you have received the delivery.
          </p>
        )}
        <ol className="mt-4 space-y-2 text-sm text-neutral-600">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600">
              1
            </span>
            ProcurePal confirms and prepares your order.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600">
              2
            </span>
            It is dispatched to {delivery.city || 'your delivery address'} and marked out for delivery.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600">
              3
            </span>
            You confirm receipt — and the incoming stock becomes usable stock.
          </li>
        </ol>
      </section>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <Truck className="h-4 w-4 text-primary-600" aria-hidden="true" />
            Delivering to
          </h2>
          <p className="mt-2 text-sm font-medium text-neutral-900">{delivery.label ?? 'Delivery address'}</p>
          <p className="mt-0.5 text-sm text-neutral-700">{delivery.contactName}</p>
          <p className="mt-0.5 flex items-start gap-1.5 text-sm text-neutral-600">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
            <span>
              {addressLines}
              {delivery.landmark ? ` (near ${delivery.landmark})` : ''}
            </span>
          </p>
          {delivery.contactPhone && (
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-neutral-600">
              <Phone className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
              {delivery.contactPhone}
            </p>
          )}
          {delivery.notes && (
            <p className="mt-2 rounded-md bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-600">{delivery.notes}</p>
          )}
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <CreditCard className="h-4 w-4 text-primary-600" aria-hidden="true" />
            Payment
          </h2>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-neutral-600">Method</dt>
              <dd className="text-right font-medium text-neutral-900">
                {PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-neutral-600">Status</dt>
              <dd>
                <PaymentStatusBadge status={order.paymentStatus} showIcon={false} />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-neutral-600">Placed</dt>
              <dd className="text-right font-medium text-neutral-900">
                {formatDateTime(order.placedAt ?? order.createdAt)}
              </dd>
            </div>
            {order.placedByUsername && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-neutral-600">Placed by</dt>
                <dd className="text-right font-medium text-neutral-900">{order.placedByUsername}</dd>
              </div>
            )}
          </dl>
        </section>
      </div>

      <section className="mt-5 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-900">
          {order.distinctItemCount} {order.distinctItemCount === 1 ? 'product' : 'products'} · {order.itemCount} units
        </h2>
        <ul className="mt-3 divide-y divide-neutral-100">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
              <ProductImage src={item.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-md" iconClassName="h-5 w-5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-neutral-900">{item.productName}</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {formatQuantity(item.quantity, item.unitOfMeasure)} · {formatNaira(item.unitPrice)}{' '}
                  {formatPerUnit(item.unitOfMeasure)}
                  {item.productSku ? ` · ${item.productSku}` : ''}
                </p>
                {incomingCreated && item.outstandingQuantity > 0 && (
                  <p className="mt-0.5 text-xs text-warning-700">
                    {formatQuantity(item.outstandingQuantity, item.unitOfMeasure)} incoming
                  </p>
                )}
              </div>
              <p className="shrink-0 text-sm font-medium text-neutral-900">{formatNaira(item.lineTotal)}</p>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-2 border-t border-neutral-100 pt-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-neutral-600">Subtotal</dt>
            <dd className="font-medium text-neutral-900">{formatNaira(order.subtotal)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-neutral-600">Delivery</dt>
            <dd className={`font-medium ${order.deliveryFee === 0 ? 'text-accent-700' : 'text-neutral-900'}`}>
              {order.deliveryFee === 0 ? 'Free' : formatNaira(order.deliveryFee)}
            </dd>
          </div>
          <div className="flex items-center justify-between border-t border-neutral-100 pt-2">
            <dt className="font-semibold text-neutral-900">Total</dt>
            <dd className="text-lg font-bold text-neutral-900">{formatNaira(order.total)}</dd>
          </div>
        </dl>

        {order.customerNote && (
          <div className="mt-3 rounded-md bg-neutral-50 px-3 py-2">
            <p className="text-xs font-medium text-neutral-500">Your note</p>
            <p className="mt-0.5 whitespace-pre-line text-sm text-neutral-700">{order.customerNote}</p>
          </div>
        )}
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link to={`/app/orders/${order.id}`} className={buttonClassName('primary')}>
          Track this order
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link to="/" className={buttonClassName('secondary')}>
          Continue shopping
        </Link>
      </div>

      {(settings.supportEmail || settings.supportPhone) && (
        <p className="mt-4 text-sm text-neutral-500">
          Something not right? Quote {order.orderNumber} and contact us
          {settings.supportEmail && (
            <>
              {' '}
              at{' '}
              <a href={`mailto:${settings.supportEmail}`} className="text-primary-600 hover:underline">
                {settings.supportEmail}
              </a>
            </>
          )}
          {settings.supportPhone && <> or on {settings.supportPhone}</>}.
        </p>
      )}
    </div>
  )
}
