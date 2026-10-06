import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Minus, Plus } from 'lucide-react'
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
  /** Quick stock in / out on each row, without leaving the list (C1, finding U2). */
  quickActions?: ProductQuickActions
}

export interface ProductQuickActions {
  canStockIn: boolean
  canStockOut: boolean
  onAction: (kind: 'in' | 'out', product: Product) => void
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

export function ProductTable({ products, sort, onSortChange, incomingFor, selection, virtual, quickActions }: ProductTableProps) {
  const hasQuickActions = quickActions != null && (quickActions.canStockIn || quickActions.canStockOut)
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
  const columnCount = columns.length + (selection ? 1 : 0) + (hasQuickActions ? 1 : 0)

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
          {hasQuickActions && (
            <th scope="col" className="w-24 border-b border-neutral-200 bg-neutral-50 px-2 py-2.5">
              <span className="sr-only">Quick stock in and out</span>
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {virtual && virtual.paddingTop > 0 && (
          <tr aria-hidden="true">
            <td colSpan={columnCount} style={{ height: virtual.paddingTop, padding: 0, border: 0 }} />
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
              data-product-row={product.id}
              className={
                isSelected
                  ? 'group relative bg-primary-50 focus-within:bg-primary-100 hover:bg-primary-100'
                  : 'group relative focus-within:bg-neutral-50 hover:bg-neutral-50'
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
                      data-row-link
                      className="font-medium text-neutral-900 outline-none before:absolute before:inset-0 before:content-[''] focus-visible:underline"
                    >
                      {product.name}
                    </Link>
                    {/* Category and pack on one quiet line (C1): "Grains · Bag of 50 kg". The pack is
                        never shown to a vendor, who has the unit price column instead. "(default)"
                        flags that it is not the product's only pack, without restating the others. */}
                    {(() => {
                      const pack =
                        !isVendor && (product.unitOfMeasure || product.packagingUnit || product.packagingSize != null)
                          ? `${formatUnitOfMeasure(
                              unitOfMeasureLabel(product.unitOfMeasure),
                              unitOfMeasureLabel(product.packagingUnit),
                              product.packagingSize,
                            )}${product.hasMultiplePacks ? ' (default)' : ''}`
                          : null
                      const line = [product.categoryName, pack].filter(Boolean).join(' · ')
                      return line ? <p className="truncate text-xs text-neutral-500">{line}</p> : null
                    })()}
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
                {/* Calm by default: "Inactive" is the exception worth a badge; active is the norm. */}
                {product.active ? (
                  <span className="text-xs text-neutral-500">Active</span>
                ) : (
                  <StatusBadge active={false} />
                )}
              </td>
              {hasQuickActions && (
                // Shown on hover or keyboard focus — and always on a device that can't hover (a
                // tablet gets this table too) — always in the tab order, and lifted above the
                // row-wide link so a click records stock instead of opening the product.
                <td className="relative z-10 border-b border-neutral-100 px-2 py-2.5">
                  <div className="flex justify-end gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                    {quickActions.canStockIn && (
                      <QuickButton label={`Stock in ${product.name}`} onClick={() => quickActions.onAction('in', product)}>
                        <Plus className="h-4 w-4" aria-hidden="true" />
                      </QuickButton>
                    )}
                    {quickActions.canStockOut && (
                      <QuickButton label={`Stock out ${product.name}`} onClick={() => quickActions.onAction('out', product)}>
                        <Minus className="h-4 w-4" aria-hidden="true" />
                      </QuickButton>
                    )}
                  </div>
                </td>
              )}
            </tr>
          )
        })}
        {virtual && virtual.paddingBottom > 0 && (
          <tr aria-hidden="true">
            <td colSpan={columnCount} style={{ height: virtual.paddingBottom, padding: 0, border: 0 }} />
          </tr>
        )}
      </tbody>
    </table>
  )
}

function QuickButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      {children}
    </button>
  )
}
