import { Pencil } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { ListingToggle } from '@/features/marketplace/components/ListingToggle'
import { MarketplaceThumb } from '@/features/marketplace/components/MarketplaceThumb'
import { StockBreakdown } from '@/features/marketplace/components/StockBreakdown'
import type { AdminCatalogProduct } from '@/features/marketplace/types'
import { formatNaira } from '@/utils/money'
import { formatPerUnit } from '@/utils/units'

export interface CatalogProductTableProps {
  products: AdminCatalogProduct[]
  selectedIds: string[]
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  onToggleListing: (product: AdminCatalogProduct) => void
  onEdit: (product: AdminCatalogProduct) => void
  /** Ids with a listing write in flight — their switch is frozen so a double-click cannot race. */
  pendingIds: string[]
}

/** Catalog administration at desktop width: selection, listing state and the three stock numbers. */
export function CatalogProductTable({
  products,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onToggleListing,
  onEdit,
  pendingIds,
}: CatalogProductTableProps) {
  const allSelected = products.length > 0 && products.every((product) => selectedIds.includes(product.id))
  const someSelected = selectedIds.length > 0 && !allSelected

  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">ProcurePal products and their marketplace listing state</caption>
      <thead>
        <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-medium tracking-wide text-neutral-500 uppercase">
          <th scope="col" className="w-10 px-4 py-2.5">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(node) => {
                if (node) node.indeterminate = someSelected
              }}
              onChange={onToggleSelectAll}
              aria-label={allSelected ? 'Clear selection' : 'Select every product on this page'}
              className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
          </th>
          <th scope="col" className="px-4 py-2.5">
            Product
          </th>
          <th scope="col" className="px-4 py-2.5">
            Category
          </th>
          <th scope="col" className="px-4 py-2.5 text-right">
            Price
          </th>
          <th scope="col" className="w-56 px-4 py-2.5">
            Stock
          </th>
          <th scope="col" className="px-4 py-2.5">
            Listed
          </th>
          <th scope="col" className="px-4 py-2.5 text-right">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {products.map((product) => {
          const selected = selectedIds.includes(product.id)
          const pending = pendingIds.includes(product.id)

          return (
            <tr key={product.id} className={`border-b border-neutral-100 last:border-b-0 ${selected ? 'bg-primary-50/40' : 'hover:bg-neutral-50'}`}>
              <td className="px-4 py-3 align-top">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggleSelect(product.id)}
                  aria-label={`Select ${product.name}`}
                  className="mt-1 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                />
              </td>
              <td className="px-4 py-3 align-top">
                <div className="flex gap-3">
                  <MarketplaceThumb src={product.imageUrl} alt={product.name} className="h-10 w-10 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-neutral-900">{product.name}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {product.sku}
                      {product.brand ? ` · ${product.brand}` : ''}
                    </p>
                    {!product.active && (
                      <Badge variant="neutral" className="mt-1">
                        Inactive in inventory
                      </Badge>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 align-top">
                {product.categoryName ? (
                  <span className="text-neutral-700">{product.categoryName}</span>
                ) : (
                  <span className="text-warning-700">Uncategorised</span>
                )}
              </td>
              <td className="px-4 py-3 text-right align-top">
                <p className="font-medium tabular-nums text-neutral-900">{formatNaira(product.unitPrice)}</p>
                <p className="mt-0.5 text-xs text-neutral-500">{formatPerUnit(product.unitOfMeasure)}</p>
              </td>
              <td className="px-4 py-3 align-top">
                <StockBreakdown product={product} />
              </td>
              <td className="px-4 py-3 align-top">
                <div className="flex items-center gap-2">
                  <ListingToggle
                    listed={product.listed}
                    label={product.name}
                    disabled={pending || !product.active}
                    disabledReason={
                      !product.active
                        ? 'Reactivate this product in Inventory before listing it on the storefront'
                        : 'Saving…'
                    }
                    onChange={() => onToggleListing(product)}
                  />
                  <span className={`text-xs font-medium ${product.listed ? 'text-accent-700' : 'text-neutral-500'}`}>
                    {product.listed ? 'Listed' : 'Hidden'}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-right align-top">
                <button
                  type="button"
                  onClick={() => onEdit(product)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  Edit
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
