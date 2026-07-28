import { BadgeCheck, CircleCheckBig, HandCoins, Lock } from 'lucide-react'
import { Button } from '@/components/Button'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge'
import { awaitsCustomerReceipt, nextStatusActions, type StatusAction } from '@/features/marketplace/formatters'
import type { AdminOrder } from '@/features/marketplace/types'
import { formatNaira } from '@/utils/money'

export interface OrderFulfilmentPanelProps {
  order: AdminOrder
  onSelectAction: (action: StatusAction) => void
  onSettlePayment: () => void
  settling: boolean
}

/**
 * The "what can I do with this order" panel — the reason the page exists.
 *
 * Every button comes from the server's `allowedNextStatuses` (via `nextStatusActions`). Nothing
 * here re-implements the state machine, so an order that the backend would refuse to advance
 * simply has no button, rather than a button that fails.
 */
export function OrderFulfilmentPanel({ order, onSelectAction, onSettlePayment, settling }: OrderFulfilmentPanelProps) {
  const actions = nextStatusActions(order.allowedNextStatuses)
  const buyerConfirmsNext = awaitsCustomerReceipt(order.allowedNextStatuses)
  // The COD settle button, per the contract: pay-on-delivery orders only, and only while the money
  // is still outstanding. The server is idempotent if two people press it anyway.
  const canSettle = order.paymentMethod === 'PAY_ON_DELIVERY' && order.paymentStatus !== 'PAID'

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4" aria-labelledby="fulfilment-heading">
      <h2 id="fulfilment-heading" className="text-sm font-semibold text-neutral-900">
        Fulfilment
      </h2>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <OrderStatusBadge status={order.status} />
        <PaymentStatusBadge status={order.paymentStatus} />
      </div>

      {actions.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {actions.map((action) => (
            <Button
              key={action.status}
              variant={action.variant}
              onClick={() => onSelectAction(action)}
              className="w-full"
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {buyerConfirmsNext && (
        <p className="mt-4 flex items-start gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
          <span>
            The customer marks this <strong className="font-medium text-neutral-800">received</strong> themselves — that
            is what moves the goods into their inventory, so ProcurePal cannot do it for them.
          </span>
        </p>
      )}

      {actions.length === 0 && !buyerConfirmsNext && (
        <p className="mt-4 flex items-start gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
          <CircleCheckBig className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
          <span>
            {order.status === 'CANCELLED'
              ? 'This order was cancelled — there is nothing left to fulfil.'
              : order.status === 'RECEIVED'
                ? 'This order is closed: the customer has taken the goods into their inventory.'
                : 'There is nothing to do here right now — the next move is not ProcurePal’s.'}
          </span>
        </p>
      )}

      {canSettle && (
        <div className="mt-4 border-t border-neutral-100 pt-4">
          <p className="flex items-start gap-2 text-sm text-neutral-600">
            <HandCoins className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" aria-hidden="true" />
            <span>
              Pay on delivery — <strong className="font-medium text-neutral-900">{formatNaira(order.total)}</strong> to
              collect from the customer.
            </span>
          </p>
          <Button variant="secondary" onClick={onSettlePayment} loading={settling} className="mt-3 w-full">
            <BadgeCheck className="h-4 w-4" />
            Record payment received
          </Button>
        </div>
      )}

      {order.paymentMethod === 'PAY_ON_DELIVERY' && order.paymentStatus === 'PAID' && (
        <p className="mt-4 border-t border-neutral-100 pt-4 text-sm text-accent-700">
          Cash collected and reconciled — nothing outstanding on this order.
        </p>
      )}
    </section>
  )
}
