import { useState } from 'react'
import { CreditCard, PackageCheck, Repeat, Warehouse } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { AddressCard } from '@/components/AddressCard'
import { Button, buttonClassName } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { useToast } from '@/components/useToast'
import { PAYMENT_METHOD_LABELS } from '@/constants/orderStatus'
import { useCart } from '@/features/cart/hooks/useCart'
import { CancelOrderModal } from '@/features/orders/components/CancelOrderModal'
import { OrderDetailSkeleton } from '@/features/orders/components/OrderDetailSkeleton'
import { OrderItemsList } from '@/features/orders/components/OrderItemsList'
import { OrderTimeline } from '@/features/orders/components/OrderTimeline'
import { ReceiveOrderModal } from '@/features/orders/components/ReceiveOrderModal'
import { ReorderResultModal } from '@/features/orders/components/ReorderResultModal'
import { ordersApi } from '@/features/orders/api/ordersApi'
import { formatOrderDateTime } from '@/features/orders/formatters'
import { useOrder } from '@/features/orders/hooks/useOrder'
import { useRetryPayment } from '@/features/orders/hooks/useRetryPayment'
import { invalidateIncomingStock } from '@/features/orders/incomingStock'
import type { Order, ReorderResult } from '@/features/orders/types'
import { isAppError } from '@/types/api'
import { formatNaira } from '@/utils/money'

function TotalsRow({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${emphasis ? 'text-base font-semibold' : 'text-sm'}`}>
      <dt className={emphasis ? 'text-neutral-900' : 'text-neutral-600'}>{label}</dt>
      <dd className={emphasis ? 'text-neutral-900' : 'text-neutral-900'}>{value}</dd>
    </div>
  )
}

/**
 * One purchase — `/app/orders/:id`.
 *
 * **Every action on this page is driven off the server's `canCancel`, `canReceive` and
 * `allowedNextStatuses`.** Nothing here re-derives the order state machine from `status`; a
 * frontend copy of those rules drifts the first time the backend adds a state, and the buyer
 * carve-out (only the buyer may move DELIVERED → RECEIVED) exists on the server precisely so the
 * client does not have to know about it.
 */
export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { refetch: refetchCart } = useCart()
  const { order, setOrder, loading, error, refetch } = useOrder(id)
  const { retry, pendingOrderId } = useRetryPayment()

  const [showReceive, setShowReceive] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [reorderResult, setReorderResult] = useState<ReorderResult | null>(null)

  const canReceiveDeliveries = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.RECEIVE_DELIVERIES)
  const canPlaceOrders = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.PLACE_ORDERS)

  function handleReceived(updated: Order, receivedUnits: number, fullyReceived: boolean) {
    setOrder(updated)
    setShowReceive(false)
    // The inventory screens read incoming stock from the buyer's open orders; this is the one
    // moment those numbers move, so the shared derivation is invalidated rather than left stale.
    invalidateIncomingStock()
    showToast(
      fullyReceived
        ? `${receivedUnits} units added to your usable stock. This order is complete.`
        : `${receivedUnits} units added to your usable stock. The rest stays as incoming until it arrives.`,
      'success',
    )
  }

  function handleCancelled(updated: Order) {
    setOrder(updated)
    setShowCancel(false)
    invalidateIncomingStock()
    showToast(`Order ${updated.orderNumber} cancelled.`, 'success')
  }

  async function handleReorder() {
    if (!order) return
    setReordering(true)
    try {
      const result = await ordersApi.reorder(order.id)
      // The cart is shared across the company and lives in its own context; without this the
      // header badge would keep showing the pre-reorder count.
      refetchCart()
      setReorderResult(result)
    } catch (err: unknown) {
      showToast(isAppError(err) ? err.message : 'Could not rebuild this order into your cart.', 'error')
    } finally {
      setReordering(false)
    }
  }

  if (loading) return <OrderDetailSkeleton />

  if (error || !order) {
    return (
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'My orders', to: '/app/orders' }, { label: 'Order' }]} />
        <ErrorState
          title="Order not available"
          message={error ?? 'We could not find this order.'}
          onRetry={refetch}
          action={
            <Link to="/app/orders" className={buttonClassName('secondary')}>
              Back to my orders
            </Link>
          }
        />
      </div>
    )
  }

  const outstandingUnits = order.items.reduce((sum, item) => sum + item.outstandingQuantity, 0)
  // Incoming stock exists from PLACED onwards; before payment nothing has been reserved, and a
  // cancelled order has had its remainder handed back.
  const showsIncoming = order.status !== 'PENDING_PAYMENT' && order.status !== 'CANCELLED' && outstandingUnits > 0

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs items={[{ label: 'My orders', to: '/app/orders' }, { label: order.orderNumber }]} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{order.orderNumber}</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Placed {formatOrderDateTime(order.placedAt ?? order.createdAt)}
            {order.placedByUsername ? ` by ${order.placedByUsername}` : ''}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {order.status === 'PENDING_PAYMENT' && (
            <Button onClick={() => void retry(order.id)} loading={pendingOrderId === order.id}>
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              Retry payment
            </Button>
          )}
          {canPlaceOrders && (
            <Button variant="secondary" onClick={() => void handleReorder()} loading={reordering}>
              <Repeat className="h-4 w-4" aria-hidden="true" />
              Reorder
            </Button>
          )}
          {order.canCancel && (
            <Button variant="danger" onClick={() => setShowCancel(true)}>
              Cancel order
            </Button>
          )}
        </div>
      </div>

      {/* The headline action, when the server says receipt is possible. It sits above everything
          else because it is the step between "the goods are here" and "the goods are usable". */}
      {order.canReceive && (
        <div className="flex flex-col gap-3 rounded-lg border border-warning-200 bg-warning-50 p-4 sm:flex-row sm:items-center">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-100 text-warning-700">
            <PackageCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-warning-900">
              {outstandingUnits} {outstandingUnits === 1 ? 'unit is' : 'units are'} waiting to be confirmed
            </p>
            <p className="mt-0.5 text-sm text-warning-800">
              They are showing in your inventory as incoming stock. Confirming what arrived adds them to your usable
              inventory — and you can confirm part of a delivery if only part of it turned up.
            </p>
          </div>
          {canReceiveDeliveries ? (
            <Button onClick={() => setShowReceive(true)} className="shrink-0">
              <PackageCheck className="h-4 w-4" aria-hidden="true" />
              Confirm receipt
            </Button>
          ) : (
            <p className="shrink-0 text-sm text-warning-800">
              You do not have permission to confirm deliveries — ask a colleague with the
              &ldquo;receive deliveries&rdquo; permission.
            </p>
          )}
        </div>
      )}

      {order.status === 'CANCELLED' && order.cancellationReason && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3">
          <p className="text-sm font-medium text-danger-800">Cancelled</p>
          <p className="mt-0.5 text-sm text-danger-700">{order.cancellationReason}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-base font-semibold text-neutral-900">
              Items <span className="font-normal text-neutral-500">({order.distinctItemCount})</span>
            </h2>
            <div className="mt-3">
              <OrderItemsList order={order} showsIncoming={showsIncoming} />
            </div>
          </section>

          {showsIncoming && (
            <section className="rounded-lg border border-warning-200 bg-warning-50 p-5">
              <h2 className="flex items-center gap-2 text-base font-semibold text-warning-900">
                <Warehouse className="h-4.5 w-4.5" aria-hidden="true" />
                These goods are already in your inventory — as incoming stock
              </h2>
              <p className="mt-1.5 text-sm text-warning-800">
                {outstandingUnits} {outstandingUnits === 1 ? 'unit is' : 'units are'} reserved against your products so
                nobody re-orders something that is already on its way. They are <strong>not</strong> counted as stock
                you can use or sell until you confirm you have received them.
              </p>
              <Link
                to="/app/products"
                className="mt-3 inline-block text-sm font-medium text-warning-900 underline hover:text-warning-700"
              >
                See it in your inventory
              </Link>
            </section>
          )}

          {order.customerNote && (
            <section className="rounded-lg border border-neutral-200 bg-white p-5">
              <h2 className="text-base font-semibold text-neutral-900">Your note to ProcurePal</h2>
              <p className="mt-1.5 text-sm text-neutral-600">{order.customerNote}</p>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-base font-semibold text-neutral-900">Payment</h2>
            <dl className="mt-3 flex flex-col gap-2">
              <TotalsRow label="Subtotal" value={formatNaira(order.subtotal)} />
              <TotalsRow
                label="Delivery"
                value={order.deliveryFee > 0 ? formatNaira(order.deliveryFee) : 'Free'}
              />
              <div className="border-t border-neutral-100 pt-2">
                <TotalsRow label="Total" value={formatNaira(order.total)} emphasis />
              </div>
            </dl>
            <div className="mt-4 border-t border-neutral-100 pt-3 text-sm">
              <p className="text-neutral-500">Method</p>
              <p className="mt-0.5 text-neutral-900">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</p>
              <div className="mt-2">
                <PaymentStatusBadge status={order.paymentStatus} />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-base font-semibold text-neutral-900">Delivering to</h2>
            <p className="mt-1 text-xs text-neutral-500">
              The address as it was at checkout — editing your address book will not change it.
            </p>
            <AddressCard
              className="mt-3"
              address={{
                // The snapshot has no id of its own; addressId may be absent if the original
                // address row was since removed, so the order id keeps the key stable.
                id: order.delivery.addressId ?? order.id,
                label: order.delivery.label ?? 'Delivery address',
                contactName: order.delivery.contactName,
                contactPhone: order.delivery.contactPhone,
                addressLine1: order.delivery.addressLine1,
                addressLine2: order.delivery.addressLine2,
                city: order.delivery.city,
                state: order.delivery.state,
                landmark: order.delivery.landmark,
                deliveryNotes: order.delivery.notes,
              }}
            />
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-base font-semibold text-neutral-900">Tracking</h2>
            <div className="mt-4">
              <OrderTimeline order={order} />
            </div>
          </section>
        </div>
      </div>

      {showReceive && <ReceiveOrderModal order={order} onClose={() => setShowReceive(false)} onSuccess={handleReceived} />}
      {showCancel && <CancelOrderModal order={order} onClose={() => setShowCancel(false)} onSuccess={handleCancelled} />}
      {reorderResult && <ReorderResultModal result={reorderResult} onClose={() => setReorderResult(null)} />}
    </div>
  )
}
