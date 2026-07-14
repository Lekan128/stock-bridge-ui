import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { LowStockBadge } from '@/features/products/components/LowStockBadge'
import { ProductImage } from '@/features/products/components/ProductImage'
import { StatusBadge } from '@/features/products/components/StatusBadge'
import { formatCurrency } from '@/features/products/formatters'
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
}

const columns: { field: ProductSortField; label: string; align?: 'right' }[] = [
  { field: 'name', label: 'Name' },
  { field: 'sku', label: 'SKU' },
  { field: 'unitPrice', label: 'Unit price', align: 'right' },
  { field: 'quantityOnHand', label: 'Quantity on hand', align: 'right' },
  { field: 'active', label: 'Status' },
]

export function ProductTable({ products, sort, onSortChange }: ProductTableProps) {
  const navigate = useNavigate()

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
        {products.map((product) => (
          <tr
            key={product.id}
            onClick={() => navigate(`/products/${product.id}`)}
            style={
              product.isLowStock ? { boxShadow: 'inset 4px 0 0 0 var(--color-warning-500)' } : undefined
            }
            className="cursor-pointer hover:bg-neutral-50"
          >
            <td className="border-b border-neutral-100 px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <ProductImage src={product.imageUrl} alt={product.name} className="h-8 w-8 shrink-0 rounded-md" />
                <span className="font-medium text-neutral-900">{product.name}</span>
              </div>
            </td>
            <td className="border-b border-neutral-100 px-4 py-2.5 text-neutral-600">{product.sku}</td>
            <td className="border-b border-neutral-100 px-4 py-2.5 text-right text-neutral-700">
              {formatCurrency(product.unitPrice)}
            </td>
            <td className="border-b border-neutral-100 px-4 py-2.5 text-right">
              <div className="flex items-center justify-end gap-2">
                {product.isLowStock && <LowStockBadge />}
                <span className="font-medium text-neutral-900">{product.quantityOnHand}</span>
              </div>
            </td>
            <td className="border-b border-neutral-100 px-4 py-2.5">
              <StatusBadge active={product.active} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
