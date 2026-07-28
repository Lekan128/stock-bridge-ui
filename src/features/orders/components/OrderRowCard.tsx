import { Link } from 'react-router-dom'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge'
import { OrderRowActions } from '@/features/orders/components/OrderRowActions'
import { formatItemCount, formatOrderDateTime } from '@/features/orders/formatters'
import type { OrderSummary } from '@/features/orders/types'
import { formatNaira } from '@/utils/money'

export interface OrderRowCardProps {
  order: OrderSummary
  onRetryPayment: (orderId: string) => void
  retrying: boolean
}

/** The sub-`md` layout. Same information as the table row, stacked to fit 375px. */
export function OrderRowCard({ order, onRetryPayment, retrying }: OrderRowCardProps) {
  const awaitingReceipt = order.status === 'DELIVERED'

  return (
    <Link
      to={`/app/orders/${order.id}`}
      className={`block rounded-lg border p-4 shadow-sm transition-colors ${
        awaitingReceipt
          ? 'border-warning-200 border-l-4 border-l-warning-500 bg-warning-50 hover:bg-warning-100'
          : 'border-neutral-200 bg-white hover:bg-neutral-50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-900">{order.orderNumber}</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {formatOrderDateTime(order.placedAt ?? order.createdAt)} · {formatItemCount(order.itemCount)}
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold text-neutral-900">{formatNaira(order.total)}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <OrderStatusBadge status={order.status} />
        <PaymentStatusBadge status={order.paymentStatus} />
      </div>

      {awaitingReceipt && (
        <p className="mt-2 text-xs font-medium text-warning-800">
          Delivered — confirm receipt to move these goods into your usable stock.
        </p>
      )}

      <div className="mt-3 empty:mt-0">
        <OrderRowActions order={order} onRetryPayment={onRetryPayment} retrying={retrying} layout="stacked" />
      </div>
    </Link>
  )
}
