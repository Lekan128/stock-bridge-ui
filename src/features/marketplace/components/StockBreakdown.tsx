import { TriangleAlert } from 'lucide-react'
import type { AdminCatalogProduct } from '@/features/marketplace/types'
import { formatQuantity } from '@/utils/units'

export interface StockBreakdownProps {
  product: AdminCatalogProduct
  /** `row` for the dense table cell, `card` for the phone layout and the edit modal. */
  layout?: 'row' | 'card'
}

/**
 * The three stock numbers, kept apart.
 *
 * Warehouse staff have three different jobs and each needs a different number: count the shelf
 * (`quantityOnHand`), pick what is already sold (`committedQuantity`), and know what the shop is
 * advertising (`availableToSell`). One combined figure would have to lie about either the
 * warehouse or the storefront, so all three are shown, labelled.
 *
 * The state worth shouting about is "stock on the shelf, nothing available to sell" — that is
 * every "why has my product disappeared from the site?" question, answered before it is asked.
 */
export function StockBreakdown({ product, layout = 'row' }: StockBreakdownProps) {
  // Older API builds omit the two derived figures; fall back to the honest interpretation
  // (nothing committed) rather than rendering blanks.
  const committed = product.committedQuantity ?? 0
  const available = product.availableToSell ?? Math.max(0, product.quantityOnHand - committed)
  const soldOutButStocked = available === 0 && product.quantityOnHand > 0

  const unit = product.unitOfMeasure

  return (
    <div className={layout === 'row' ? 'text-xs' : 'text-sm'}>
      <dl className="flex flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-neutral-500">On hand</dt>
          <dd className="font-medium tabular-nums text-neutral-900">{formatQuantity(product.quantityOnHand, unit)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-neutral-500">Committed</dt>
          <dd className={`tabular-nums ${committed > 0 ? 'font-medium text-warning-700' : 'text-neutral-600'}`}>
            {formatQuantity(committed, unit)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-neutral-100 pt-0.5">
          <dt className="text-neutral-500">Available to sell</dt>
          <dd className={`font-medium tabular-nums ${available === 0 ? 'text-danger-600' : 'text-accent-700'}`}>
            {formatQuantity(available, unit)}
          </dd>
        </div>
      </dl>

      {soldOutButStocked && (
        <p className="mt-1 flex items-start gap-1 text-xs font-medium text-warning-700">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          <span>Sold out on the storefront — every unit on the shelf is already owed to an order.</span>
        </p>
      )}

      {product.incomingQuantity > 0 && (
        <p className="mt-1 text-xs text-neutral-500">{product.incomingQuantity} incoming from suppliers</p>
      )}
    </div>
  )
}
