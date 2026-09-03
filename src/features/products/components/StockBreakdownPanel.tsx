import type { ReactNode } from 'react'
import { ArrowRight, PackageCheck, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import type { ResolvedIncoming } from '@/features/orders/incomingStock'
import { LowStockBadge } from '@/features/products/components/LowStockBadge'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import type { Product } from '@/features/products/types'
import { formatNumber, formatQuantity, formatQuantityEcho, unitNoun } from '@/features/products/unitCopy'
import { fromBaseQuantity, productsOwnUnits, stockUnitLabel, unitOptionsForProduct } from '@/features/products/unitSet'

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
 *
 * <h2>Every figure here carries its stock unit</h2>
 * It did not. This panel's headline was a bare `1000` in 3xl type — `UNIT_UX_REMEDIATION_PLAN.md`
 * §3's P2, and the single most prominent violation of `UNIT_UX_CONTRACT.md` §7.2 in the app: the
 * one number a user looks at before every operational decision, with nothing on screen saying
 * whether it meant kilograms or bags. On a product configured as a 50 kg bag those two readings
 * are a factor of fifty apart.
 *
 * The unit is set in smaller, lighter type on the same baseline as the number rather than in the
 * same 3xl weight, because it is a label on the figure, not part of it — "1,000 kg" must not read
 * as a bigger number than "1,000". That is Odoo's inventory-on-hand card and Zoho's item detail
 * treatment, and it is why the caption line above stays plain prose: the unit belongs to the
 * number, not to the heading.
 */
export function StockBreakdownPanel({ product, incoming, actions }: StockBreakdownPanelProps) {
  const { options: unitOfMeasureOptions } = useUnitOfMeasureOptions()
  const hasIncoming = incoming.quantity > 0

  // Every quantity on this panel — on hand, incoming, the sum, and each order line — is in the
  // product's stock unit, so one label is resolved once and reused rather than re-derived per
  // figure. Falls back to "units" for a product that never got a stock unit set (contract §2.1's
  // single-entry set), which is at least honest about being unitless.
  const productUnits = unitOptionsForProduct(product, unitOfMeasureOptions)
  const unitLabel = stockUnitLabel(productUnits)

  /**
   * "1,600 kg" also stated as "= 20 bags", once per pack this product is configured with.
   *
   * Only whole packs are worth saying: 19.6 bags is not a sentence anyone wants, and a part-pack
   * is exactly the case where the stock unit is the honest answer. So a figure that does not
   * divide evenly is left as the stock unit alone rather than rounded into a number that would
   * then disagree with the shelf.
   */
  const packEquivalents = productsOwnUnits(productUnits)
    .filter((option) => option.isPack && option.factorToStockUnit > 0)
    .map((option) => ({ code: option.code, inPacks: fromBaseQuantity(product.quantityOnHand, option), option }))
    .filter((line) => Number.isInteger(line.inPacks) && line.inPacks > 0)
    // `formatQuantityEcho` rather than a hand-built `= ${...}`: the same two characters now open
    // the product form's opening-stock echo and the price-tier form's stored-quantity line, and
    // one helper is what stops them drifting into three spellings of the same idea.
    .map((line) => ({ code: line.code, text: formatQuantityEcho(line.inPacks, unitNoun(line.option)) }))

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-neutral-500">On hand — usable now</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-2">
              <span
                className={`text-3xl font-semibold ${product.quantityOnHand > 0 ? 'text-neutral-900' : 'text-neutral-400'}`}
              >
                {formatNumber(product.quantityOnHand)}
              </span>
              <span className="text-base font-medium text-neutral-500">{unitLabel}</span>
              {product.isLowStock && (
                <span className="self-center">
                  <LowStockBadge />
                </span>
              )}
            </div>
            {/* The same figure in the packs this product is actually bought and sold in.
                Storage stays in the stock unit — a pack size that changes must never silently
                rewrite what is on the shelf — but nobody counts 1,600 kg of rice, they count 20
                bags, and making them divide in their head is how a stock screen stops being read.
                Odoo and NetSuite both hold stock in the base unit and let packagings ride on top;
                this is that, shown rather than left to arithmetic. */}
            {packEquivalents.length > 0 && (
              <p className="mt-1 text-sm text-neutral-600">
                {packEquivalents.map((line, index) => (
                  <span key={line.code}>
                    {index > 0 && <span className="text-neutral-300"> · </span>}
                    {line.text}
                  </span>
                ))}
              </p>
            )}
            <p className="mt-1 text-xs text-neutral-500">Available to pick, sell or use today.</p>
          </div>

          <div className={hasIncoming ? 'rounded-md border border-warning-200 bg-warning-50 p-3' : ''}>
            <p className={`flex items-center gap-1.5 text-sm ${hasIncoming ? 'text-warning-800' : 'text-neutral-500'}`}>
              <Truck className="h-3.5 w-3.5" aria-hidden="true" />
              Incoming — pending delivery
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
              <span className={`text-3xl font-semibold ${hasIncoming ? 'text-warning-700' : 'text-neutral-300'}`}>
                {formatNumber(incoming.quantity)}
              </span>
              <span className={`text-base font-medium ${hasIncoming ? 'text-warning-800' : 'text-neutral-300'}`}>
                {unitLabel}
              </span>
            </div>
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
            <span className="font-medium text-neutral-700">
              {formatQuantity(product.quantityOnHand + incoming.quantity, unitLabel)}
            </span>{' '}
            after you confirm receipt of everything that is on its way.
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
                  <span className="text-sm text-neutral-600">{formatQuantity(line.quantity, unitLabel)}</span>
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
