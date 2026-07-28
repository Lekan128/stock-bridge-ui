import { MarketplaceThumb } from '@/features/marketplace/components/MarketplaceThumb'
import type { AdminOrder } from '@/features/marketplace/types'
import { formatNaira } from '@/utils/money'
import { formatPerUnit, formatQuantity } from '@/utils/units'

/**
 * The picking list and the money.
 *
 * Quantities always carry their unit of measure — "12" is meaningless in a wholesale catalog where
 * it could be 12 sachets or 12 pallets, and the person reading this is about to put it on a van.
 * Once a delivery is partly received, the outstanding quantity is called out per line, because
 * that is exactly what is still sitting as incoming stock on the customer's books.
 */
export function OrderItemsPanel({ order }: { order: AdminOrder }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white" aria-labelledby="items-heading">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
        <h2 id="items-heading" className="text-sm font-semibold text-neutral-900">
          Items
        </h2>
        <p className="text-sm text-neutral-500">
          {order.distinctItemCount} product{order.distinctItemCount === 1 ? '' : 's'} · {order.itemCount} unit
          {order.itemCount === 1 ? '' : 's'}
        </p>
      </div>

      {order.items.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-neutral-500">
          This order has no line items. It was almost certainly abandoned before checkout completed — do not dispatch
          anything against it.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-3 px-4 py-3">
              <MarketplaceThumb src={item.imageUrl} alt={item.productName} className="h-12 w-12 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-neutral-900">{item.productName}</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {item.productSku}
                  {item.productSku && ' · '}
                  {formatNaira(item.unitPrice)} {formatPerUnit(item.unitOfMeasure)}
                </p>
                <p className="mt-1 text-sm text-neutral-700">{formatQuantity(item.quantity, item.unitOfMeasure)}</p>
                {item.receivedQuantity > 0 && item.outstandingQuantity > 0 && (
                  <p className="mt-1 text-xs font-medium text-warning-700">
                    {item.receivedQuantity} received · {item.outstandingQuantity} still outstanding
                  </p>
                )}
              </div>
              <p className="shrink-0 text-sm font-medium tabular-nums text-neutral-900">{formatNaira(item.lineTotal)}</p>
            </li>
          ))}
        </ul>
      )}

      <dl className="flex flex-col gap-2 border-t border-neutral-200 px-4 py-3 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-neutral-500">Subtotal</dt>
          <dd className="tabular-nums text-neutral-700">{formatNaira(order.subtotal)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-neutral-500">Delivery</dt>
          <dd className="tabular-nums text-neutral-700">
            {order.deliveryFee === 0 ? 'Free' : formatNaira(order.deliveryFee)}
          </dd>
        </div>
        <div className="flex items-center justify-between border-t border-neutral-100 pt-2">
          <dt className="font-medium text-neutral-900">Total</dt>
          <dd className="text-base font-semibold tabular-nums text-neutral-900">{formatNaira(order.total)}</dd>
        </div>
      </dl>
    </section>
  )
}
