import { Link } from 'react-router-dom'
import { Badge } from '@/components/Badge'
import { ProductImage } from '@/features/products/components/ProductImage'
import type { Order } from '@/features/orders/types'
import { formatNaira } from '@/utils/money'
import { formatPerUnit, formatQuantity } from '@/utils/units'

export interface OrderItemsListProps {
  order: Order
  /** True once incoming stock exists for this order (past payment, not cancelled). */
  showsIncoming: boolean
}

/**
 * The order lines, with the received/outstanding split spelled out per line.
 *
 * Deliberately one component for both breakpoints: an order rarely has more than a handful of
 * lines, and a row of stacked label/value pairs reads correctly at 375px and at 1440px, whereas a
 * six-column table does not. Every quantity carries its unit of measure — "8" is meaningless when
 * it could be sachets or pallets.
 */
export function OrderItemsList({ order, showsIncoming }: OrderItemsListProps) {
  return (
    <ul className="divide-y divide-neutral-100">
      {order.items.map((item) => {
        const incoming = showsIncoming ? item.outstandingQuantity : 0

        return (
          <li key={item.id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
            <ProductImage
              src={item.imageUrl}
              alt={item.productName}
              className="h-14 w-14 shrink-0 rounded-md"
              iconClassName="h-5 w-5"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <Link
                  to={`/product/${item.productId}`}
                  className="text-sm font-medium text-neutral-900 hover:text-primary-700 hover:underline"
                >
                  {item.productName}
                </Link>
                <span className="text-sm font-medium text-neutral-900">{formatNaira(item.lineTotal)}</span>
              </div>
              <p className="mt-0.5 text-xs text-neutral-500">
                {item.productSku ? `${item.productSku} · ` : ''}
                {formatNaira(item.unitPrice)} {formatPerUnit(item.unitOfMeasure)}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span className="text-neutral-600">
                  Ordered <strong className="font-medium text-neutral-900">{formatQuantity(item.quantity, item.unitOfMeasure)}</strong>
                </span>
                {item.receivedQuantity > 0 && (
                  <span className="text-accent-700">
                    Received into stock <strong className="font-medium">{item.receivedQuantity}</strong>
                  </span>
                )}
                {incoming > 0 && (
                  <Badge variant="warning">
                    {incoming} incoming — not usable yet
                  </Badge>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
