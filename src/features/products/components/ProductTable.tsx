import { useEffect, useRef } from 'react'
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

/**
 * Row selection, for the bulk actions that operate on a chosen set — today, "Stock in selected",
 * which carries the ticked ids into the pre-filled stock sheet (bulk-import contract §3's
 * `productIds`).
 *
 * Optional on purpose: the low-stock list and the ProcurePal catalog reuse this table and have
 * nothing to select for, and a column of dead checkboxes on those screens would be worse than
 * no feature at all.
 */
export interface ProductTableSelection {
  selectedIds: string[]
  onToggle: (id: string, selected: boolean) => void
  /** Ticks or clears every row currently on screen — never rows on other pages. */
  onToggleAll: (selected: boolean) => void
}

export interface ProductTableProps {
  products: Product[]
  sort: ProductSort
  onSortChange: (field: ProductSortField) => void
  /** Incoming stock per product. Omit where there is none to show (e.g. a ProcurePal-side list). */
  incomingFor?: (product: Product) => { quantity: number }
  selection?: ProductTableSelection
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

export function ProductTable({ products, sort, onSortChange, incomingFor, selection }: ProductTableProps) {
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

  const selectedOnPage = products.filter((product) => selection?.selectedIds.includes(product.id)).length
  const allOnPageSelected = products.length > 0 && selectedOnPage === products.length
  /**
   * "Some but not all" is a third state, and a checkbox that shows it as *unticked* tells the
   * reader their selection was lost. `indeterminate` is a DOM property with no HTML attribute,
   * so it can only be set imperatively.
   */
  const headerRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (headerRef.current) headerRef.current.indeterminate = selectedOnPage > 0 && !allOnPageSelected
  }, [selectedOnPage, allOnPageSelected])

  return (
    <table className="w-full border-separate border-spacing-0 text-sm">
      <thead>
        <tr>
          {selection && (
            <th scope="col" className="w-10 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
              <input
                ref={headerRef}
                type="checkbox"
                checked={allOnPageSelected}
                onChange={(event) => selection.onToggleAll(event.target.checked)}
                aria-label={
                  allOnPageSelected
                    ? `Clear the ${products.length} products selected on this page`
                    : `Select every product on this page (${products.length})`
                }
                className="h-4 w-4 cursor-pointer rounded-sm border-neutral-300 accent-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              />
            </th>
          )}
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
          const isSelected = selection?.selectedIds.includes(product.id) ?? false

          return (
            <tr
              key={product.id}
              onClick={() => navigate(`/app/products/${product.id}`)}
              style={
                product.isLowStock ? { boxShadow: 'inset 4px 0 0 0 var(--color-warning-500)' } : undefined
              }
              // A ticked row is tinted, so the selection is legible from the shape of the table
              // rather than only from a 16px box in the first column — DESIGN.md's stated use
              // for primary-100/50.
              className={
                isSelected ? 'cursor-pointer bg-primary-50 hover:bg-primary-100' : 'cursor-pointer hover:bg-neutral-50'
              }
            >
              {selection && (
                // The row navigates on click, so the tick must not: stopPropagation on the cell
                // covers the label padding as well as the box itself.
                <td
                  className="border-b border-neutral-100 px-4 py-2.5"
                  onClick={(event) => event.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(event) => selection.onToggle(product.id, event.target.checked)}
                    aria-label={`Select ${product.name}`}
                    className="h-4 w-4 cursor-pointer rounded-sm border-neutral-300 accent-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  />
                </td>
              )}
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
