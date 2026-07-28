import { useState } from 'react'
import { ArrowLeft, ShieldAlert, Wallet } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import { PAYMENT_METHOD_LABELS } from '@/constants/orderStatus'
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge'
import { useToast } from '@/components/useToast'
import { OrderCustomerPanel } from '@/features/marketplace/components/OrderCustomerPanel'
import { OrderDetailSkeleton } from '@/features/marketplace/components/OrderDetailSkeleton'
import { OrderFulfilmentPanel } from '@/features/marketplace/components/OrderFulfilmentPanel'
import { OrderItemsPanel } from '@/features/marketplace/components/OrderItemsPanel'
import { OrderTimelinePanel } from '@/features/marketplace/components/OrderTimelinePanel'
import { QueryErrorState } from '@/features/marketplace/components/QueryErrorState'
import { StatusAdvanceModal } from '@/features/marketplace/components/StatusAdvanceModal'
import { marketplaceAdminApi } from '@/features/marketplace/api/marketplaceAdminApi'
import { formatDateTime, orderPlacedAt, type StatusAction } from '@/features/marketplace/formatters'
import { useAdminOrder } from '@/features/marketplace/hooks/useAdminOrder'
import { isAppError } from '@/types/api'
import { formatNaira } from '@/utils/money'

/**
 * ProcurePal's single-order fulfilment screen.
 *
 * The whole page is driven by the server's own view of the order: `allowedNextStatuses` decides
 * which buttons exist, and each mutation responds with the full updated order, which is fed
 * straight back into state. Nothing here guesses what the next legal state is.
 */
export function MarketplaceOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { order, setOrder, loading, error, refetch } = useAdminOrder(id)
  const { showToast } = useToast()

  const [pendingAction, setPendingAction] = useState<StatusAction | null>(null)
  const [advancing, setAdvancing] = useState(false)
  const [settleOpen, setSettleOpen] = useState(false)
  const [settling, setSettling] = useState(false)

  async function handleAdvance(note: string) {
    if (!order || !pendingAction) return
    setAdvancing(true)
    try {
      const updated = await marketplaceAdminApi.advanceStatus(order.id, {
        status: pendingAction.status,
        note: note || undefined,
      })
      setOrder(updated)
      setPendingAction(null)
      showToast(`${order.orderNumber} is now ${updated.status.toLowerCase().replace(/_/g, ' ')}.`, 'success')
    } catch (err: unknown) {
      // The server owns the state machine, so a rejection here is information, not a bug to hide:
      // it usually means somebody else advanced the same order a second earlier.
      showToast(isAppError(err) ? err.message : 'That status change could not be applied.', 'error')
      refetch()
    } finally {
      setAdvancing(false)
    }
  }

  async function handleSettlePayment() {
    if (!order) return
    setSettling(true)
    try {
      const updated = await marketplaceAdminApi.recordPaymentReceived(order.id)
      setOrder(updated)
      setSettleOpen(false)
      showToast(`Payment recorded for ${order.orderNumber}.`, 'success')
    } catch (err: unknown) {
      showToast(isAppError(err) ? err.message : 'The payment could not be recorded.', 'error')
    } finally {
      setSettling(false)
    }
  }

  if (loading) return <OrderDetailSkeleton />

  if (error || !order) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          to="/app/marketplace/orders"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to the order queue
        </Link>
        <QueryErrorState
          title="This order could not be loaded"
          message={error ?? 'The order is unavailable.'}
          onRetry={refetch}
        />
      </div>
    )
  }

  const isOpen = order.status !== 'CANCELLED' && order.status !== 'RECEIVED'
  // Two very different "not paid" situations. A card/transfer order that has not been paid is a
  // reason NOT to release goods; a pay-on-delivery order is expected to be unpaid, and the risk is
  // the opposite one — dispatching without telling the rider what to collect.
  const awaitingPrepayment = isOpen && order.paymentMethod === 'MONNIFY' && order.paymentStatus !== 'PAID'
  const cashToCollect = isOpen && order.paymentMethod === 'PAY_ON_DELIVERY' && order.paymentStatus !== 'PAID'

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        items={[
          { label: 'Order queue', to: '/app/marketplace/orders' },
          { label: order.orderNumber },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Placed {formatDateTime(orderPlacedAt(order))} · {PAYMENT_METHOD_LABELS[order.paymentMethod]} ·{' '}
            {formatNaira(order.total)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.paymentStatus} />
        </div>
      </div>

      {awaitingPrepayment && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3"
        >
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-danger-800">
              {formatNaira(order.total)} has not been paid
            </p>
            <p className="mt-0.5 text-sm text-danger-700">
              This is a pay-now order and the payment has not cleared
              {order.paymentStatus === 'FAILED' ? ' (the customer’s attempt failed)' : ''}. Do not dispatch these goods
              until it does.
            </p>
          </div>
        </div>
      )}

      {cashToCollect && (
        <div className="flex items-start gap-3 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3">
          <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-warning-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-warning-900">
              Collect {formatNaira(order.total)} on delivery
            </p>
            <p className="mt-0.5 text-sm text-warning-800">
              Tell the rider what to collect, then record the payment here once the cash is handed in.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Actions come first in the DOM so that at phone width — where this column stacks on top —
            the operator lands on the buttons rather than scrolling past the whole picking list. */}
        <div className="flex flex-col gap-4 lg:order-2">
          <OrderFulfilmentPanel
            order={order}
            onSelectAction={setPendingAction}
            onSettlePayment={() => setSettleOpen(true)}
            settling={settling}
          />
          <OrderCustomerPanel order={order} />
        </div>

        <div className="flex flex-col gap-4 lg:order-1 lg:col-span-2">
          <OrderItemsPanel order={order} />
          <OrderTimelinePanel order={order} />
        </div>
      </div>

      <StatusAdvanceModal
        action={pendingAction}
        orderNumber={order.orderNumber}
        customerName={order.customer?.name ?? 'this customer'}
        submitting={advancing}
        onConfirm={(note) => void handleAdvance(note)}
        onCancel={() => setPendingAction(null)}
      />

      <ConfirmDialog
        open={settleOpen}
        title="Record payment received"
        message={`Confirm that ${formatNaira(order.total)} has been collected from ${
          order.customer?.name ?? 'the customer'
        } for ${order.orderNumber}. This marks the order paid and cannot be undone from here.`}
        confirmLabel="Payment received"
        confirmVariant="primary"
        loading={settling}
        onConfirm={() => void handleSettlePayment()}
        onCancel={() => setSettleOpen(false)}
      />
    </div>
  )
}
