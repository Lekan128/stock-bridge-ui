import { Link } from 'react-router-dom'
import { expectedCopy } from '@/features/expected/copy'
import { IncomingStockBadge } from '@/features/products/components/IncomingStockBadge'
import { StockBar } from '@/features/products/components/StockBar'
import { StockFigure } from '@/features/products/components/StockFigure'
import { ProductImage } from '@/features/products/components/ProductImage'
import { StatusBadge } from '@/features/products/components/StatusBadge'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import { packEquivalent } from '@/features/products/packEquivalent'
import type { Product } from '@/features/products/types'
import { formatNumber } from '@/features/products/unitCopy'
import { resolveUnitSymbol } from '@/features/products/unitSet'

export interface ProductCardProps {
  product: Product
  /** Units bought from ProcurePal and not yet received. Rendered as pending, never as available. */
  incoming?: number
}

export function ProductCard({ product, incoming = 0 }: ProductCardProps) {
  // Module-cached list (see the hook), so a page of cards shares one fetch.
  const { options: unitOfMeasureOptions } = useUnitOfMeasureOptions()
  const packLine = packEquivalent(product, unitOfMeasureOptions)

  return (
    <Link
      to={`/app/products/${product.id}`}
      className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm transition-colors hover:bg-neutral-50"
    >
      <ProductImage src={product.imageUrl} alt={product.name} className="h-12 w-12 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-neutral-900">{product.name}</p>
          <StatusBadge active={product.active} />
        </div>
        <p className="mt-0.5 truncate text-xs text-neutral-500">
          {product.sku}
          {product.categoryName != null && ` · ${product.categoryName}`}
        </p>
        <div className="mt-1.5 flex flex-wrap items-end justify-between gap-x-3 gap-y-1.5">
          {/* "usable" is spelled out rather than implied — this is the line someone reads before
              deciding whether they can fulfil an order today, and "12 on hand · +20 incoming" must
              never be misread as 32. The figure is the same component as the table's (B2). */}
          <div className="flex flex-col gap-1">
            <StockFigure
              quantity={product.quantityOnHand}
              unit={resolveUnitSymbol(product.unitOfMeasure, unitOfMeasureOptions)}
              pack={packLine}
              productId={product.id}
              label="usable"
            />
            {/* On an open expected delivery (task 3.1) — a promise, not stock. Quiet, and never
                summed into the figure above. */}
            {product.expectedQuantity != null && product.expectedQuantity > 0 && (
              <span className="text-xs text-neutral-500">
                <span aria-hidden="true">{expectedCopy.product.coming(formatNumber(product.expectedQuantity))}</span>
                <span className="sr-only">{expectedCopy.product.comingAria(formatNumber(product.expectedQuantity))}</span>
              </span>
            )}
          </div>
          <StockBar
            quantity={product.quantityOnHand}
            threshold={product.lowStockThreshold}
            low={product.isLowStock}
            unit={resolveUnitSymbol(product.unitOfMeasure, unitOfMeasureOptions)}
          />
          <IncomingStockBadge quantity={incoming} />
        </div>
      </div>
    </Link>
  )
}
