import { Warehouse } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Skeleton } from '@/components/Skeleton'
import { FreeDeliveryNudge } from '@/features/cart/components/FreeDeliveryNudge'
import { groupCartBySeller, type CartItem } from '@/features/cart/types'
import type { CheckoutQuote } from '@/features/checkout/types'
import { ProductImage } from '@/features/products/components/ProductImage'
import { formatNaira } from '@/utils/money'
import { formatQuantity } from '@/utils/units'

export interface OrderSummaryPanelProps {
  quote: CheckoutQuote | null
  items: CartItem[]
  loading: boolean
  refreshing: boolean
}

/**
 * The order summary that stays on screen through all three checkout steps.
 *
 * Totals come from the quote, never from the cart's own arithmetic: the delivery fee, the
 * free-delivery threshold and the minimum-order rule are commercial policy the server owns, and a
 * locally-computed total that disagrees with what is charged is the single worst bug this screen
 * can have. The cart supplies only the line thumbnails and names.
 *
 * That rule binds harder now that a basket can split. Delivery is charged PER SELLER, so the
 * per-group figures rendered here are read straight from `quote.sellerGroups` — summing the cart's
 * own lines and applying one fee would understate the total the buyer is about to be charged.
 */
export function OrderSummaryPanel({ quote, items, loading, refreshing }: OrderSummaryPanelProps) {
  // The line list is grouped from the CART (which carries a seller per line) while the money comes
  // from the QUOTE's own groups. They are two views of the same split and agree by construction:
  // both order ProcurePal first, then sellers by name.
  const groups = groupCartBySeller(items)
  const isSplit = (quote?.sellerGroups?.length ?? groups.length) > 1

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-neutral-900">Order summary</h2>

      <ul className="mt-3 max-h-64 space-y-3 overflow-y-auto pr-1">
        {groups.map((group) => (
          <li key={group.sellerId ?? 'unattributed'}>
            {/* The seller heading only appears once there is more than one. On a single-seller
                basket - still the common case - it would be a label over the entire list, which
                says nothing and costs vertical space on the panel that has least of it. */}
            {isSplit && (
              <p className="mb-1.5 truncate text-xs font-semibold text-neutral-500">Sold by {group.sellerName}</p>
            )}
            <ul className="space-y-3">
              {group.items.map((item) => (
                <li key={item.productId} className="flex gap-2.5">
                  <ProductImage
                    src={item.imageUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-md"
                    iconClassName="h-4 w-4"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-neutral-900">{item.productName}</p>
                    <p className="text-xs text-neutral-500">{formatQuantity(item.quantity, item.unitOfMeasure)}</p>
                  </div>
                  <p className="shrink-0 text-xs font-medium text-neutral-900">{formatNaira(item.lineTotal)}</p>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {quote && quote.freeDeliveryThreshold > 0 && !quote.freeDeliveryApplied && (
        <FreeDeliveryNudge
          subtotal={quote.subtotal}
          deliveryFee={quote.deliveryFee}
          freeDeliveryThreshold={quote.freeDeliveryThreshold}
          className="mt-4"
        />
      )}

      {loading && !quote ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-6 w-32" />
        </div>
      ) : quote ? (
        // Dimmed while re-quoting after an address change, rather than replaced by a spinner —
        // the previous total stays readable and is visibly marked as being recalculated.
        <dl className={`mt-4 space-y-2 border-t border-neutral-100 pt-3 text-sm ${refreshing ? 'opacity-60' : ''}`}>
          {/* THE SPLIT, SHOWN BEFORE THE BUYER CONFIRMS.

              This is the screen where "why was I charged three delivery fees" is either answered
              or becomes a support ticket. Delivery is priced per seller because each group ships
              from a different warehouse, so the per-group fees are itemised here rather than
              folded into one line that would look like a single delivery being overcharged.

              Rendered only when the basket actually splits: on a single-seller basket this would
              restate the totals immediately below it. */}
          {isSplit && (
            <div className="space-y-2 rounded-md bg-neutral-50 p-3">
              <p className="text-xs font-semibold text-neutral-900">
                This basket becomes {quote.sellerGroups.length} orders
              </p>
              <p className="text-xs leading-relaxed text-neutral-500">
                One per seller, each delivered and tracked separately — so each carries its own
                delivery fee. You still pay once, for the total below.
              </p>
              {quote.sellerGroups.map((group) => (
                <div key={group.sellerId} className="border-t border-neutral-200 pt-2 text-xs">
                  <p className="truncate font-medium text-neutral-900">{group.sellerName}</p>
                  <div className="mt-0.5 flex items-center justify-between text-neutral-500">
                    <span>
                      {formatNaira(group.subtotal)} goods
                      {' + '}
                      {group.freeDeliveryApplied ? 'free delivery' : `${formatNaira(group.deliveryFee)} delivery`}
                    </span>
                    <span className="font-medium text-neutral-900">{formatNaira(group.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <dt className="text-neutral-600">
              Subtotal
              <span className="text-neutral-400"> ({quote.itemCount} units)</span>
            </dt>
            <dd className="font-medium text-neutral-900">{formatNaira(quote.subtotal)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-neutral-600">
              {isSplit ? `Delivery (${quote.sellerGroups.length} orders)` : 'Delivery'}
            </dt>
            <dd className={`font-medium ${quote.freeDeliveryApplied ? 'text-accent-700' : 'text-neutral-900'}`}>
              {quote.freeDeliveryApplied ? 'Free' : formatNaira(quote.deliveryFee)}
            </dd>
          </div>
          <div className="flex items-center justify-between border-t border-neutral-100 pt-2">
            <dt className="font-semibold text-neutral-900">Total</dt>
            <dd className="text-lg font-bold text-neutral-900" aria-live="polite">
              {formatNaira(quote.total)}
            </dd>
          </div>
          {refreshing && <p className="text-xs text-neutral-400">Recalculating for the selected address…</p>}
        </dl>
      ) : null}

      <div className="mt-4 rounded-md bg-warning-50 p-3">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-warning-900">
          <Warehouse className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            These items will appear in your inventory as <strong className="font-semibold">incoming stock</strong>, and
            become usable stock when you confirm the delivery.
          </span>
        </p>
      </div>

      <Link
        to="/cart"
        className="mt-3 inline-block rounded text-xs font-medium text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        Edit cart
      </Link>
    </div>
  )
}
