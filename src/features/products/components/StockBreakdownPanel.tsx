import type { ReactNode } from 'react'
import { ArrowRight, PackageCheck, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import type { ResolvedIncoming } from '@/features/orders/incomingStock'
import { LowStockBadge } from '@/features/products/components/LowStockBadge'
import type { Product } from '@/features/products/types'

export interface StockBreakdownPanelProps {
  product: Product
  incoming: ResolvedIncoming
  /** Stock In / Stock Out / Adjust, rendered by the page when the user may manage inventory. */
  actions?: ReactNode
}

/**
 * The full answer to "how much of this do I actually have?".
 *
 * Two figures, side by side, that must never be confused:
 *   • **On hand** — usable today. Neutral/dark, the dominant number, because it is the one every
 *     operational decision is made against.
 *   • **Incoming** — paid for, en route, unusable. Amber, visually subordinate, and labelled
 *     "pending delivery" in words rather than left to a colour to imply.
 *
 * Their sum is shown once, greyed and explicitly captioned "after you confirm receipt", so the
 * reader can see the future position without ever mistaking it for the present one.
 */
export function StockBreakdownPanel({ product, incoming, actions }: StockBreakdownPanelProps) {
  const hasIncoming = incoming.quantity > 0

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-neutral-500">On hand — usable now</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span
                className={`text-3xl font-semibold ${product.quantityOnHand > 0 ? 'text-neutral-900' : 'text-neutral-400'}`}
              >
                {product.quantityOnHand}
              </span>
              {product.isLowStock && <LowStockBadge />}
            </div>
            <p className="mt-1 text-xs text-neutral-500">Available to pick, sell or use today.</p>
          </div>

          <div className={hasIncoming ? 'rounded-md border border-warning-200 bg-warning-50 p-3' : ''}>
            <p className={`flex items-center gap-1.5 text-sm ${hasIncoming ? 'text-warning-800' : 'text-neutral-500'}`}>
              <Truck className="h-3.5 w-3.5" aria-hidden="true" />
              Incoming — pending delivery
            </p>
            <span className={`mt-1 block text-3xl font-semibold ${hasIncoming ? 'text-warning-700' : 'text-neutral-300'}`}>
              {incoming.quantity}
            </span>
            <p className={`mt-1 text-xs ${hasIncoming ? 'text-warning-800' : 'text-neutral-400'}`}>
              {hasIncoming
                ? 'Bought from ProcurePal and paid for, but not yet received. Not usable and not counted above.'
                : 'Nothing on its way from ProcurePal right now.'}
            </p>
          </div>
        </div>

        {actions && <div className="flex flex-wrap gap-2 sm:shrink-0">{actions}</div>}
      </div>

      {hasIncoming && (
        <div className="mt-4 border-t border-neutral-100 pt-3">
          <p className="text-sm text-neutral-500">
            <span className="font-medium text-neutral-700">{product.quantityOnHand + incoming.quantity}</span> after you
            confirm receipt of everything that is on its way.
          </p>

          {incoming.orders.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {incoming.orders.map((line) => (
                <li
                  key={`${line.orderId}-${line.catalogProductId}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-neutral-200 px-3 py-2"
                >
                  <Link
                    to={`/app/orders/${line.orderId}`}
                    className="text-sm font-medium text-primary-700 hover:underline"
                  >
                    {line.orderNumber}
                  </Link>
                  <OrderStatusBadge status={line.status} />
                  <span className="text-sm text-neutral-600">{line.quantity} units</span>
                  {line.awaitingReceipt && (
                    <Link
                      to={`/app/orders/${line.orderId}`}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-warning-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-warning-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning-500"
                    >
                      <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      Confirm receipt
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* The per-order breakdown needs the order that created the stock. When the quantity came
              straight off the product row and no matching open order was scanned, say so rather
              than showing an empty list that reads like a bug. */}
          {incoming.ordersUnknown && (
            <Link
              to="/app/orders"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:underline"
            >
              Find the orders bringing this stock
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
