import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { IncomingStockBadge } from '@/features/products/components/IncomingStockBadge'
import { LowStockBadge } from '@/features/products/components/LowStockBadge'
import { ProductImage } from '@/features/products/components/ProductImage'
import { StatusBadge } from '@/features/products/components/StatusBadge'
import { formatCurrency, formatUnitOfMeasure } from '@/features/products/formatters'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import type { Product } from '@/features/products/types'

export type ProductSortField = 'name' | 'sku' | 'unitPrice' | 'quantityOnHand' | 'active'
export type SortDirection = 'asc' | 'desc'

export interface ProductSort {
  field: ProductSortField
  direction: SortDirection
}

export interface ProductTableProps {
  products: Product[]
  sort: ProductSort
  onSortChange: (field: ProductSortField) => void
  /** Incoming stock per product. Omit where there is none to show (e.g. a ProcurePal-side list). */
  incomingFor?: (product: Product) => { quantity: number }
}

// "On hand (usable)" rather than "Quantity on hand": once a second quantity exists on the row,
// the header has to say which one it is sorting and which one you can actually use.
//
// Unit price is a marketplace selling price and is `null` for EVERY row a buying company owns
// — showing the column at all for them would be an entire column of blanks, so it is built
// conditionally in the component rather than declared here as a fixed list.
const BASE_COLUMNS: { field: ProductSortField; label: string; align?: 'right' }[] = [
  { field: 'name', label: 'Name' },
  { field: 'sku', label: 'SKU' },
  { field: 'quantityOnHand', label: 'On hand (usable)', align: 'right' },
  { field: 'active', label: 'Status' },
]
const UNIT_PRICE_COLUMN: { field: ProductSortField; label: string; align?: 'right' } = {
  field: 'unitPrice',
  label: 'Unit price',
  align: 'right',
}

export function ProductTable({ products, sort, onSortChange, incomingFor }: ProductTableProps) {
  const navigate = useNavigate()
  const { isVendor } = useAuth()
  // Only fetched for the subtitle a company sees in place of the unit price column — a vendor's
  // row already carries its price, so there is nothing extra to look up for them.
  const { options: unitOfMeasureOptions } = useUnitOfMeasureOptions()

  const columns = isVendor
    ? [BASE_COLUMNS[0], BASE_COLUMNS[1], UNIT_PRICE_COLUMN, ...BASE_COLUMNS.slice(2)]
    : BASE_COLUMNS

  // Both `unitOfMeasure` and `packagingUnit` codes live in the same fetched list — one lookup
  // serves both.
  function unitOfMeasureLabel(code: string | undefined): string | undefined {
    return unitOfMeasureOptions.find((option) => option.code === code)?.label
  }

  return (
    <table className="w-full border-separate border-spacing-0 text-sm">
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.field}
              scope="col"
              className={`border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-xs font-medium text-neutral-500 ${
                col.align === 'right' ? 'text-right' : 'text-left'
              }`}
            >
              <button
                type="button"
                onClick={() => onSortChange(col.field)}
                className={`inline-flex items-center gap-1 hover:text-neutral-700 ${col.align === 'right' ? 'flex-row-reverse' : ''}`}
              >
                {col.label}
                {sort.field === col.field ? (
                  sort.direction === 'asc' ? (
                    <ArrowUp className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDown className="h-3.5 w-3.5" />
                  )
                ) : (
                  <ArrowUpDown className="h-3.5 w-3.5 text-neutral-300" />
                )}
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {products.map((product) => {
          const incoming = incomingFor?.(product).quantity ?? 0

          return (
            <tr
              key={product.id}
              onClick={() => navigate(`/app/products/${product.id}`)}
              style={
                product.isLowStock ? { boxShadow: 'inset 4px 0 0 0 var(--color-warning-500)' } : undefined
              }
              className="cursor-pointer hover:bg-neutral-50"
            >
              <td className="border-b border-neutral-100 px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <ProductImage src={product.imageUrl} alt={product.name} className="h-8 w-8 shrink-0 rounded-md" />
                  <div className="min-w-0">
                    <span className="font-medium text-neutral-900">{product.name}</span>
                    {/* A company has no unit price column to look at, so the packaging fact that
                        would normally sit beside a price ("Bag of 50 kg") is surfaced here
                        instead — never shown to a vendor, who already has the unit price column
                        and would find this redundant clutter under every name. */}
                    {!isVendor &&
                      (product.unitOfMeasure || product.packagingUnit || product.packagingSize != null) && (
                        <p className="truncate text-xs text-neutral-500">
                          {formatUnitOfMeasure(
                            unitOfMeasureLabel(product.unitOfMeasure),
                            unitOfMeasureLabel(product.packagingUnit),
                            product.packagingSize,
                          )}
                        </p>
                      )}
                  </div>
                </div>
              </td>
              <td className="border-b border-neutral-100 px-4 py-2.5 text-neutral-600">{product.sku}</td>
              {isVendor && (
                <td className="border-b border-neutral-100 px-4 py-2.5 text-right text-neutral-700">
                  {formatCurrency(product.unitPrice)}
                </td>
              )}
              <td className="border-b border-neutral-100 px-4 py-2.5 text-right">
                <div className="flex items-center justify-end gap-2">
                  {product.isLowStock && <LowStockBadge />}
                  {/* Zero usable stock is greyed rather than bolded even when a delivery is en
                      route — the number you can act on today is still nought. */}
                  <span className={product.quantityOnHand > 0 ? 'font-medium text-neutral-900' : 'font-medium text-neutral-400'}>
                    {product.quantityOnHand}
                  </span>
                </div>
                {/* On its own line, never summed into the figure above. */}
                {incoming > 0 && (
                  <div className="mt-1 flex justify-end">
                    <IncomingStockBadge quantity={incoming} />
                  </div>
                )}
              </td>
              <td className="border-b border-neutral-100 px-4 py-2.5">
                <StatusBadge active={product.active} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
