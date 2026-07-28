import { AlarmClock, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge'
import { formatDateTime, formatRelativeTime, isAgeing, orderPlacedAt } from '@/features/marketplace/formatters'
import type { AdminOrderSummary } from '@/features/marketplace/types'
import { formatNaira } from '@/utils/money'

/**
 * The queue row at phone width. Same information hierarchy as the table — who, when, how much,
 * where — with the two badges on their own line so neither ever truncates.
 */
export function OrderQueueCard({ order }: { order: AdminOrderSummary }) {
  const isNew = order.status === 'PLACED'
  const placedAt = orderPlacedAt(order)
  const destination = [order.deliveryCity, order.deliveryState].filter(Boolean).join(', ')

  return (
    <Link
      to={`/app/marketplace/orders/${order.id}`}
      className={`flex flex-col gap-2 rounded-lg border bg-white p-3 shadow-sm transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none ${
        isNew ? 'border-warning-200 border-l-4 border-l-warning-500' : 'border-neutral-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium text-neutral-900">
            <span className="truncate">{order.orderNumber}</span>
            {isNew && (
              <span className="shrink-0 rounded-sm bg-warning-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-warning-800 uppercase">
                New
              </span>
            )}
          </p>
          <p className="mt-0.5 truncate text-sm text-neutral-600">{order.customer?.name ?? 'Unknown company'}</p>
        </div>
        <p className="shrink-0 text-sm font-semibold tabular-nums text-neutral-900">{formatNaira(order.total)}</p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <OrderStatusBadge status={order.status} />
        <PaymentStatusBadge status={order.paymentStatus} />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
        <span title={formatDateTime(placedAt)}>{formatRelativeTime(placedAt)}</span>
        <span>
          {order.itemCount} item{order.itemCount === 1 ? '' : 's'}
        </span>
        {destination && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" aria-hidden="true" />
            {destination}
          </span>
        )}
      </div>

      {isAgeing(order) && (
        <p className="inline-flex items-center gap-1 text-xs font-medium text-warning-700">
          <AlarmClock className="h-3 w-3" aria-hidden="true" />
          Waiting over a day
        </p>
      )}
    </Link>
  )
}
