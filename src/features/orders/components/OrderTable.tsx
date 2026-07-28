import { useNavigate } from 'react-router-dom'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge'
import { OrderRowActions } from '@/features/orders/components/OrderRowActions'
import { formatItemCount, formatOrderDateTime } from '@/features/orders/formatters'
import type { OrderSummary } from '@/features/orders/types'
import { formatNaira } from '@/utils/money'

export interface OrderTableProps {
  orders: OrderSummary[]
  onRetryPayment: (orderId: string) => void
  retryingOrderId: string | null
}

/** Desktop layout. Below `md` the list swaps to `OrderRowCard`, matching ProductTable/ProductCard. */
export function OrderTable({ orders, onRetryPayment, retryingOrderId }: OrderTableProps) {
  const navigate = useNavigate()

  return (
    <table className="w-full border-separate border-spacing-0 text-sm">
      <thead>
        <tr>
          {['Order', 'Placed', 'Items', 'Total', 'Status', 'Payment', ''].map((label, index) => (
            <th
              key={label || index}
              scope="col"
              className={`border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-xs font-medium text-neutral-500 ${
                label === 'Total' || label === 'Items' ? 'text-right' : 'text-left'
              }`}
            >
              {label || <span className="sr-only">Actions</span>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => {
          // Delivered-but-unconfirmed is the buyer's outstanding action and the thing standing
          // between them and usable stock, so the row is tinted and rail-marked rather than
          // sitting in the list looking exactly like six finished ones.
          const awaitingReceipt = order.status === 'DELIVERED'

          return (
            <tr
              key={order.id}
              onClick={() => navigate(`/app/orders/${order.id}`)}
              style={awaitingReceipt ? { boxShadow: 'inset 4px 0 0 0 var(--color-warning-500)' } : undefined}
              className={`cursor-pointer ${awaitingReceipt ? 'bg-warning-50 hover:bg-warning-100' : 'hover:bg-neutral-50'}`}
            >
              <td className="border-b border-neutral-100 px-4 py-3">
                <span className="font-medium text-neutral-900">{order.orderNumber}</span>
                {(order.deliveryCity || order.deliveryState) && (
                  <span className="mt-0.5 block text-xs text-neutral-500">
                    {[order.deliveryCity, order.deliveryState].filter(Boolean).join(', ')}
                  </span>
                )}
              </td>
              <td className="border-b border-neutral-100 px-4 py-3 text-neutral-600">
                {formatOrderDateTime(order.placedAt ?? order.createdAt)}
              </td>
              <td className="border-b border-neutral-100 px-4 py-3 text-right text-neutral-600">{order.itemCount}</td>
              <td className="border-b border-neutral-100 px-4 py-3 text-right font-medium text-neutral-900">
                {formatNaira(order.total)}
              </td>
              <td className="border-b border-neutral-100 px-4 py-3">
                <div className="flex flex-col items-start gap-1">
                  <OrderStatusBadge status={order.status} />
                  {awaitingReceipt && (
                    <span className="text-xs font-medium text-warning-800">Confirm to add to your stock</span>
                  )}
                </div>
              </td>
              <td className="border-b border-neutral-100 px-4 py-3">
                <PaymentStatusBadge status={order.paymentStatus} />
              </td>
              <td className="border-b border-neutral-100 px-4 py-3 text-right">
                <OrderRowActions
                  order={order}
                  onRetryPayment={onRetryPayment}
                  retrying={retryingOrderId === order.id}
                />
                <span className="sr-only">{formatItemCount(order.itemCount)}</span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
