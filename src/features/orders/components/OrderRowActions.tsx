import { CreditCard, PackageCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/Button'
import type { OrderSummary } from '@/features/orders/types'

export interface OrderRowActionsProps {
  order: OrderSummary
  onRetryPayment: (orderId: string) => void
  retrying: boolean
  /** Full-width buttons on the mobile card, inline on the desktop row. */
  layout?: 'inline' | 'stacked'
}

/**
 * The two actions a list row can offer, and nothing else.
 *
 * `PENDING_PAYMENT` → **Retry payment**. A failed or abandoned checkout does not kill the order;
 * it stays payable, and burying that behind a detail page is how an order quietly dies.
 *
 * `DELIVERED` → **Confirm receipt**, routed to the detail page rather than fired from here,
 * because receipt can be partial and needs per-line quantities. The list's job is to make the
 * outstanding action impossible to miss, not to shortcut it.
 *
 * Everything else is driven off `canCancel`/`canReceive` on the detail page — the summary DTO
 * carries neither, and re-deriving the state machine from `status` here is exactly what the
 * contract forbids. These two are the documented buyer-facing entry points, not a state machine.
 */
export function OrderRowActions({ order, onRetryPayment, retrying, layout = 'inline' }: OrderRowActionsProps) {
  const stacked = layout === 'stacked'

  if (order.status === 'PENDING_PAYMENT') {
    return (
      <Button
        onClick={(event) => {
          // The whole row is a link to the order; paying is a different destination entirely.
          event.stopPropagation()
          event.preventDefault()
          onRetryPayment(order.id)
        }}
        loading={retrying}
        className={stacked ? 'w-full' : 'px-3 py-1.5 text-xs'}
      >
        {!retrying && <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />}
        Retry payment
      </Button>
    )
  }

  if (order.status === 'DELIVERED') {
    return (
      <Link
        to={`/app/orders/${order.id}`}
        onClick={(event) => event.stopPropagation()}
        className={`inline-flex items-center justify-center gap-1.5 rounded-md bg-warning-600 font-medium text-white transition-colors hover:bg-warning-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning-500 focus-visible:ring-offset-2 ${
          stacked ? 'w-full px-4 py-2.5 text-sm' : 'px-3 py-1.5 text-xs'
        }`}
      >
        <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Confirm receipt
      </Link>
    )
  }

  return null
}
