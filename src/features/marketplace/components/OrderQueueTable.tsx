import { AlarmClock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge'
import { formatDateTime, formatRelativeTime, isAgeing, orderPlacedAt } from '@/features/marketplace/formatters'
import type { AdminOrderSummary } from '@/features/marketplace/types'
import { formatNaira } from '@/utils/money'

export interface OrderQueueTableProps {
  orders: AdminOrderSummary[]
}

function destination(order: AdminOrderSummary): string {
  const parts = [order.deliveryCity, order.deliveryState].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : '—'
}

/**
 * Desktop fulfilment queue.
 *
 * Two visual signals carry the whole screen: a new order gets an amber left rail and a bolder
 * order number, and anything that has been waiting more than a day gets a clock. Everything else
 * stays quiet, so "what needs me now" is answered before any column is read.
 */
export function OrderQueueTable({ orders }: OrderQueueTableProps) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">Customer orders awaiting fulfilment</caption>
      <thead>
        <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-medium tracking-wide text-neutral-500 uppercase">
          <th scope="col" className="px-4 py-2.5">
            Order
          </th>
          <th scope="col" className="px-4 py-2.5">
            Customer
          </th>
          <th scope="col" className="px-4 py-2.5">
            Placed
          </th>
          <th scope="col" className="px-4 py-2.5 text-right">
            Items
          </th>
          <th scope="col" className="px-4 py-2.5 text-right">
            Total
          </th>
          <th scope="col" className="px-4 py-2.5">
            Status
          </th>
          <th scope="col" className="px-4 py-2.5">
            Payment
          </th>
          <th scope="col" className="px-4 py-2.5">
            Deliver to
          </th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => {
          const isNew = order.status === 'PLACED'
          const placedAt = orderPlacedAt(order)

          return (
            <tr
              key={order.id}
              className={`border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50 ${
                isNew ? 'border-l-4 border-l-warning-500 bg-warning-50/40' : ''
              }`}
            >
              <td className="px-4 py-3">
                <Link
                  to={`/app/marketplace/orders/${order.id}`}
                  className="rounded font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                  {order.orderNumber}
                </Link>
                {isNew && (
                  <span className="ml-2 rounded-sm bg-warning-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-warning-800 uppercase">
                    New
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <p className="font-medium text-neutral-900">{order.customer?.name ?? 'Unknown company'}</p>
                {order.customer?.slug && <p className="text-xs text-neutral-500">{order.customer.slug}</p>}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-neutral-600">
                <span title={formatDateTime(placedAt)}>{formatRelativeTime(placedAt)}</span>
                {isAgeing(order) && (
                  <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-warning-700">
                    <AlarmClock className="h-3 w-3" aria-hidden="true" />
                    Waiting over a day
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-neutral-600">{order.itemCount}</td>
              <td className="px-4 py-3 text-right font-medium tabular-nums text-neutral-900">
                {formatNaira(order.total)}
              </td>
              <td className="px-4 py-3">
                <OrderStatusBadge status={order.status} />
              </td>
              <td className="px-4 py-3">
                <PaymentStatusBadge status={order.paymentStatus} />
              </td>
              <td className="px-4 py-3 text-neutral-600">{destination(order)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
