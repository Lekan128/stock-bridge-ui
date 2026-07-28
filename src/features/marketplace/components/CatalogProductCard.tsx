import { Pencil } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { ListingToggle } from '@/features/marketplace/components/ListingToggle'
import { MarketplaceThumb } from '@/features/marketplace/components/MarketplaceThumb'
import { StockBreakdown } from '@/features/marketplace/components/StockBreakdown'
import type { AdminCatalogProduct } from '@/features/marketplace/types'
import { formatNaira } from '@/utils/money'
import { formatPerUnit } from '@/utils/units'

export interface CatalogProductCardProps {
  product: AdminCatalogProduct
  selected: boolean
  onToggleSelect: () => void
  onToggleListing: () => void
  onEdit: () => void
  pending: boolean
}

/** The catalog row at phone width — same controls, stacked. */
export function CatalogProductCard({
  product,
  selected,
  onToggleSelect,
  onToggleListing,
  onEdit,
  pending,
}: CatalogProductCardProps) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border bg-white p-3 shadow-sm ${
        selected ? 'border-primary-300 bg-primary-50/40' : 'border-neutral-200'
      }`}
    >
      <div className="flex gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Select ${product.name}`}
          className="mt-1 h-4 w-4 shrink-0 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
        />
        <MarketplaceThumb src={product.imageUrl} alt={product.name} className="h-12 w-12 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-900">{product.name}</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {product.sku}
            {product.brand ? ` · ${product.brand}` : ''}
          </p>
          <p className="mt-1 text-sm font-medium text-neutral-900">
            {formatNaira(product.unitPrice)}{' '}
            <span className="text-xs font-normal text-neutral-500">{formatPerUnit(product.unitOfMeasure)}</span>
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {product.categoryName ? (
              <Badge variant="neutral">{product.categoryName}</Badge>
            ) : (
              <Badge variant="warning">Uncategorised</Badge>
            )}
            {!product.active && <Badge variant="neutral">Inactive in inventory</Badge>}
          </div>
        </div>
      </div>

      <div className="rounded-md border border-neutral-100 bg-neutral-50 px-3 py-2">
        <StockBreakdown product={product} layout="card" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListingToggle
            listed={product.listed}
            label={product.name}
            disabled={pending || !product.active}
            disabledReason={
              !product.active ? 'Reactivate this product in Inventory before listing it' : 'Saving…'
            }
            onChange={onToggleListing}
          />
          <span className={`text-sm font-medium ${product.listed ? 'text-accent-700' : 'text-neutral-500'}`}>
            {product.listed ? 'Listed' : 'Hidden'}
          </span>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          Edit
        </button>
      </div>
    </div>
  )
}
