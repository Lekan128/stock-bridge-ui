import { forwardRef, useEffect, useId, useRef, useState } from 'react'
import { CalendarClock, Download, Plus, Search, Settings, SlidersHorizontal, Tags, Truck, Upload, Zap } from 'lucide-react'
import { Button } from '@/components/Button'
import { OverflowMenu, type OverflowMenuItem } from '@/components/OverflowMenu'
import type { CompanyCategory } from '@/features/products/categories/types'
import type { ProductStatusFilter, StockStatusFilter } from '@/features/products/types'
import { useClickOutside } from '@/hooks/useClickOutside'

export type StockLevelFilter = 'all' | StockStatusFilter

export interface InventoryBarProps {
  search: string
  onSearchChange: (value: string) => void
  statusFilter: ProductStatusFilter
  onStatusFilterChange: (value: ProductStatusFilter) => void
  stockLevelFilter: StockLevelFilter
  onStockLevelFilterChange: (value: StockLevelFilter) => void
  /** Per-chip counts, when the device catalogue can answer them instantly. */
  stockLevelCounts?: Record<StockLevelFilter, number>
  categories: CompanyCategory[]
  categoryFilter: string
  onCategoryFilterChange: (categoryId: string) => void
  /** Back to the default view (active products, every category) in one step. */
  onClearFilters: () => void
  canManageProducts: boolean
  canRecordDelivery: boolean
  /** Quick mode (C4): receive, issue or count one item after another. */
  onQuickMode?: () => void
  onAddProduct: () => void
  onBulkUpload: () => void
  onRecordDelivery: () => void
  onExpectedDeliveries: () => void
  onExport: () => void
  onSkuSettings: () => void
  onManageCategories: () => void
}

// The census, not just the alarm (UX_PATTERNS.md Pattern B): every chip carries its count.
const STOCK_CHIPS: { value: StockLevelFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'OK', label: 'Well stocked' },
  { value: 'LOW', label: 'Low' },
  { value: 'OUT', label: 'Out' },
]

const STATUS_OPTIONS: { value: ProductStatusFilter; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'all', label: 'All' },
]

/** The Inventory page's "⋯": everything done a handful of times a year (C1). */
function inventoryMenuItems(props: InventoryBarProps): OverflowMenuItem[] {
  const icon = 'h-4 w-4 text-neutral-500'
  return [
    ...(props.onQuickMode
      ? [{ label: 'Quick mode', icon: <Zap className={icon} aria-hidden="true" />, onSelect: props.onQuickMode }]
      : []),
    { label: 'Expected deliveries', icon: <CalendarClock className={icon} aria-hidden="true" />, onSelect: props.onExpectedDeliveries },
    ...(props.canManageProducts
      ? [
          { label: 'Bulk upload', icon: <Upload className={icon} aria-hidden="true" />, onSelect: props.onBulkUpload },
          { label: 'Manage categories', icon: <Tags className={icon} aria-hidden="true" />, onSelect: props.onManageCategories },
          { label: 'SKU settings', icon: <Settings className={icon} aria-hidden="true" />, onSelect: props.onSkuSettings },
        ]
      : []),
    { label: 'Download my products', icon: <Download className={icon} aria-hidden="true" />, onSelect: props.onExport },
  ]
}

/**
 * The Inventory list's one compact bar (C1, finding U1 — it replaces three stacked rows of search,
 * two segmented controls and an action row). Search, the stock chips with their counts, one
 * "Filters" popover for the rarely-changed status and category, and on the right the screen's
 * action — Record a delivery, the thing done every morning — then Add product and "⋯".
 *
 * On a phone the actions move to the bottom bar (`InventoryActionBar`), and the chips scroll
 * sideways on one line instead of wrapping onto three.
 */
export const InventoryBar = forwardRef<HTMLInputElement, InventoryBarProps>(function InventoryBar(props, searchRef) {
  const { search, onSearchChange, stockLevelFilter, onStockLevelFilterChange, stockLevelCounts } = props
  return (
    // One row on a laptop — search, Filters, the chips, then the actions pushed right; on a phone,
    // search and Filters, with the chips on their own scrolling line beneath.
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      <div className="flex min-w-0 items-center gap-2 md:flex-1 md:max-w-sm">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <label htmlFor="product-search" className="sr-only">
            Search products
          </label>
          <input
            ref={searchRef}
            id="product-search"
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search name or SKU"
            aria-keyshortcuts="/"
            className="w-full rounded-md border border-neutral-200 bg-white py-2 pr-9 pl-9 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
          />
          <kbd
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded-sm border border-neutral-200 px-1.5 text-[11px] text-neutral-400 md:block"
          >
            /
          </kbd>
        </div>
        <FiltersPopover {...props} />
      </div>

      {/* One line on a phone, scrolling sideways rather than wrapping. */}
      <div className="-mx-1 overflow-x-auto px-1 md:mx-0 md:shrink-0 md:px-0">
        <div role="group" aria-label="Stock level" className="flex w-max items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-0.5">
          {STOCK_CHIPS.map((chip) => (
            <button
              key={chip.value}
              type="button"
              aria-pressed={stockLevelFilter === chip.value}
              onClick={() => onStockLevelFilterChange(chip.value)}
              className={`rounded-sm px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                stockLevelFilter === chip.value ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {chip.label}
              {stockLevelCounts && (
                <span className="ml-1.5 tabular-nums text-neutral-400">{stockLevelCounts[chip.value].toLocaleString()}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="hidden shrink-0 items-center gap-2 md:ml-auto md:flex">
        <InventoryActions {...props} />
      </div>
    </div>
  )
})

/**
 * Record a delivery is the screen's action when the person may record one; Add product is then
 * secondary. For someone who manages products but doesn't receive stock, Add product is the action.
 */
export function InventoryActions(props: InventoryBarProps & { compact?: boolean }) {
  const { canRecordDelivery, canManageProducts, onRecordDelivery, onAddProduct, compact = false } = props
  return (
    <>
      {canRecordDelivery && (
        <Button variant="action" onClick={onRecordDelivery} className={compact ? 'flex-1' : 'whitespace-nowrap'}>
          <Truck className="h-4 w-4" aria-hidden="true" />
          Record a delivery
        </Button>
      )}
      {canManageProducts && (
        <Button
          variant={canRecordDelivery ? 'secondary' : 'action'}
          onClick={onAddProduct}
          title="Add product"
          className={compact ? (canRecordDelivery ? '' : 'flex-1') : 'whitespace-nowrap'}
          aria-label={compact && !canRecordDelivery ? undefined : 'Add product'}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {compact && canRecordDelivery ? null : compact ? 'Add product' : <span className="hidden 2xl:inline">Add product</span>}
        </Button>
      )}
      <OverflowMenu label="More inventory actions" items={inventoryMenuItems(props)} />
    </>
  )
}

/** Status and category — changed rarely, so behind one button rather than always on screen. */
function FiltersPopover({
  statusFilter,
  onStatusFilterChange,
  categories,
  categoryFilter,
  onCategoryFilterChange,
  onClearFilters,
}: InventoryBarProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  useClickOutside(ref, () => setOpen(false))
  // Escape closes it from anywhere — after "Clear filters" the button that had focus is gone.
  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])
  // Active is the default view, so only a departure from it counts as a filter.
  const applied = (statusFilter !== 'active' ? 1 : 0) + (categoryFilter ? 1 : 0)
  const categoryName = categories.find((category) => category.id === categoryFilter)?.name

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
          applied > 0 ? 'border-primary-200 bg-primary-50 text-primary-800' : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
        }`}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        Filters
        {applied > 0 && <span className="tabular-nums">· {applied}</span>}
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Filters"
          className="absolute top-full left-0 z-30 mt-2 flex w-72 flex-col gap-4 rounded-md border border-neutral-200 bg-white p-4 shadow-paper"
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs font-semibold tracking-wider text-neutral-500 uppercase">Show</legend>
            <div className="flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-0.5">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={statusFilter === option.value}
                  onClick={() => onStatusFilterChange(option.value)}
                  className={`flex-1 rounded-sm px-3 py-1.5 text-sm font-medium ${
                    statusFilter === option.value ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
          {categories.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="product-category-filter" className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                Category
              </label>
              <select
                id="product-category-filter"
                value={categoryFilter}
                onChange={(event) => onCategoryFilterChange(event.target.value)}
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {applied > 0 && (
            <Button
              variant="quiet"
              className="self-start px-2 py-1"
              onClick={() => {
                onClearFilters()
                buttonRef.current?.focus()
              }}
            >
              Clear filters{categoryName ? ` (${categoryName})` : ''}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
