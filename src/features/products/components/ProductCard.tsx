import { Link } from 'react-router-dom'
import { LowStockBadge } from '@/features/products/components/LowStockBadge'
import { ProductImage } from '@/features/products/components/ProductImage'
import { StatusBadge } from '@/features/products/components/StatusBadge'
import type { Product } from '@/features/products/types'

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      to={`/products/${product.id}`}
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
        <p className="mt-0.5 truncate text-xs text-neutral-500">{product.sku}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-700">{product.quantityOnHand} on hand</span>
          {product.isLowStock && <LowStockBadge />}
        </div>
      </div>
    </Link>
  )
}
