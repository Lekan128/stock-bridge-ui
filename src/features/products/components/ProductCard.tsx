import { Link } from 'react-router-dom'
import { expectedCopy } from '@/features/expected/copy'
import { IncomingStockBadge } from '@/features/products/components/IncomingStockBadge'
import { LowStockBadge } from '@/features/products/components/LowStockBadge'
import { ProductImage } from '@/features/products/components/ProductImage'
import { StatusBadge } from '@/features/products/components/StatusBadge'
import type { Product } from '@/features/products/types'
import { formatNumber } from '@/features/products/unitCopy'

export interface ProductCardProps {
  product: Product
  /** Units bought from ProcurePal and not yet received. Rendered as pending, never as available. */
  incoming?: number
}

export function ProductCard({ product, incoming = 0 }: ProductCardProps) {
  return (
    <Link
      to={`/app/products/${product.id}`}
      className={`flex items-center gap-3 rounded-lg border bg-white p-3 shadow-sm transition-colors hover:bg-neutral-50 ${
        product.isLowStock ? 'border-warning-200 border-l-4 border-l-warning-500' : 'border-neutral-200'
      }`}
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
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {/* "usable" is spelled out rather than implied by the absence of a badge — this is the
              line someone reads before deciding whether they can fulfil an order today, and
              "12 on hand · +20 incoming" must never be misread as 32. */}
          <span className={`text-sm font-medium ${product.quantityOnHand > 0 ? 'text-neutral-700' : 'text-neutral-400'}`}>
            {product.quantityOnHand} usable
          </span>
          {/* On an open expected delivery (task 3.1) — a promise, not stock. Quiet, and never
              summed into the figure beside it. */}
          {product.expectedQuantity != null && product.expectedQuantity > 0 && (
            <span className="text-xs text-neutral-500">
              <span aria-hidden="true">{expectedCopy.product.coming(formatNumber(product.expectedQuantity))}</span>
              <span className="sr-only">{expectedCopy.product.comingAria(formatNumber(product.expectedQuantity))}</span>
            </span>
          )}
          {product.isLowStock && <LowStockBadge />}
          <IncomingStockBadge quantity={incoming} />
        </div>
      </div>
    </Link>
  )
}
