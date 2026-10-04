import { useEffect, useRef } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { expectedCopy } from '@/features/expected/copy'
import { IncomingStockBadge } from '@/features/products/components/IncomingStockBadge'
import { StockBar } from '@/features/products/components/StockBar'
import { StockFigure } from '@/features/products/components/StockFigure'
import { ProductImage } from '@/features/products/components/ProductImage'
import { StatusBadge } from '@/features/products/components/StatusBadge'
import { formatCurrency, formatUnitOfMeasure } from '@/features/products/formatters'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import type { Product } from '@/features/products/types'
import { packEquivalent } from '@/features/products/packEquivalent'
import { formatNumber } from '@/features/products/unitCopy'
import { resolveUnitSymbol } from '@/features/products/unitSet'

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

/**
 * Rendering a window of a much longer list (the on-device catalogue, A3). Rows outside the window
 * are stood in for by two spacer rows, so the table keeps its real height and scroll position and
 * keeps being a real `<table>` for screen readers. Each rendered row reports its own height through
 * `measureRef`, because rows are not all one height (a pack line, an incoming badge).
 */
export interface ProductTableVirtualWindow {
  paddingTop: number
  paddingBottom: number
  /** Position of each rendered product in the full list, in the same order as `products`. */
  indices: number[]
  measureRef: (element: HTMLTableRowElement | null) => void
}

export interface ProductTableProps {
  products: Product[]
  sort: ProductSort
  onSortChange: (field: ProductSortField) => void
  /** Incoming stock per product. Omit where there is none to show (e.g. a ProcurePal-side list). */
  incomingFor?: (product: Product) => { quantity: number }
  selection?: ProductTableSelection
  virtual?: ProductTableVirtualWindow
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

export function ProductTable({ products, sort, onSortChange, incomingFor, selection, virtual }: ProductTableProps) {
  const { isVendor } = useAuth()
  // Fetched for two things now: the packaging subtitle a company sees in place of the unit price
  // column, and — for EVERY tenant, vendor included — the stock unit stamped on the "On hand"
  // figure. A vendor's row used to need nothing from this list; a bare quantity in the on-hand
  // column was the reason it does now (`UNIT_UX_CONTRACT.md` §7.2).
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
    // `font-narrow`: Plex's condensed width for this dense table (plan §2), so long product names
    // and their figures fit on one row more often.
    <table className="w-full border-separate border-spacing-0 font-narrow text-sm">
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
                    ? `Clear the ${products.length} products selected ${virtual ? 'here' : 'on this page'}`
                    : `Select every product ${virtual ? 'shown' : 'on this page'} (${products.length})`
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
        {virtual && virtual.paddingTop > 0 && (
          <tr aria-hidden="true">
            <td colSpan={columns.length + (selection ? 1 : 0)} style={{ height: virtual.paddingTop, padding: 0, border: 0 }} />
          </tr>
        )}
        {products.map((product, position) => {
          const incoming = incomingFor?.(product).quantity ?? 0
          const isSelected = selection?.selectedIds.includes(product.id) ?? false
          const packLine = packEquivalent(product, unitOfMeasureOptions)

          return (
            // `relative` anchors the name link's stretched hit area (below) to this row, so the
            // whole row still opens the product — but as a real link: focusable, announced as a
            // link, middle-click and "open in new tab" work. A bare `<tr onClick>` had none of that.
            <tr
              key={product.id}
              ref={virtual?.measureRef}
              data-index={virtual?.indices[position]}
              // A ticked row is tinted, so the selection is legible from the shape of the table
              // rather than only from a 16px box in the first column — DESIGN.md's stated use
              // for primary-100/50.
              className={
                isSelected
                  ? 'relative bg-primary-50 focus-within:bg-primary-100 hover:bg-primary-100'
                  : 'relative focus-within:bg-neutral-50 hover:bg-neutral-50'
              }
            >
              {selection && (
                // Lifted above the row-wide link, so ticking the box — or missing it slightly and
                // hitting the cell's padding — selects rather than navigates.
                <td className="relative z-10 border-b border-neutral-100 px-4 py-2.5">
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
                    <Link
                      to={`/app/products/${product.id}`}
                      className="font-medium text-neutral-900 outline-none before:absolute before:inset-0 before:content-[''] focus-visible:underline"
                    >
                      {product.name}
                    </Link>
                    {/* The company's own category, on its own line so it reads as a label rather
                        than as part of the pack description below it. Absent (not null) when the
                        product has none — hence `!= null`. */}
                    {product.categoryName != null && (
                      <p className="truncate text-xs font-medium text-neutral-600">{product.categoryName}</p>
                    )}
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
                          {/* Terse on purpose — this subtitle already carries the pack name, so
                              the list only needs to flag that it is not the only one, not restate
                              detail the product page already owns. */}
                          {product.hasMultiplePacks && ' (default)'}
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
                <div className="flex flex-col items-end gap-1">
                  {/* The figure, its unit and pack, and anything waiting on this phone — one
                      component everywhere (B2). Zero is greyed, never bolded. */}
                  <StockFigure
                    quantity={product.quantityOnHand}
                    unit={resolveUnitSymbol(product.unitOfMeasure, unitOfMeasureOptions)}
                    pack={packLine}
                    productId={product.id}
                    align="end"
                  />
                  {/* What is on an open expected delivery — task 3.1. Understated on purpose and
                      never added to the figure: a promise a supplier made, not stock anybody can
                      pick today. Absent, not zero, when nothing is coming. */}
                  {product.expectedQuantity != null && product.expectedQuantity > 0 && (
                    <span className="text-xs text-neutral-500">
                      <span aria-hidden="true">
                        {expectedCopy.product.coming(formatNumber(product.expectedQuantity))}
                      </span>
                      <span className="sr-only">
                        {expectedCopy.product.comingAria(formatNumber(product.expectedQuantity))}
                      </span>
                    </span>
                  )}
                  {/* On hand against the alert level: replaces the row stripe and the badge (B2). */}
                  <StockBar
                    quantity={product.quantityOnHand}
                    threshold={product.lowStockThreshold}
                    low={product.isLowStock}
                    unit={resolveUnitSymbol(product.unitOfMeasure, unitOfMeasureOptions)}
                  />
                  {/* On its own line, never summed into the figure above. */}
                  {incoming > 0 && <IncomingStockBadge quantity={incoming} />}
                </div>
              </td>
              <td className="border-b border-neutral-100 px-4 py-2.5">
                <StatusBadge active={product.active} />
              </td>
            </tr>
          )
        })}
        {virtual && virtual.paddingBottom > 0 && (
          <tr aria-hidden="true">
            <td colSpan={columns.length + (selection ? 1 : 0)} style={{ height: virtual.paddingBottom, padding: 0, border: 0 }} />
          </tr>
        )}
      </tbody>
    </table>
  )
}
