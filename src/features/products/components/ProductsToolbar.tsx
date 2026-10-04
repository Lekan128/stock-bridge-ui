import { Plus, Search, Truck } from 'lucide-react'
import { Button, buttonClassName } from '@/components/Button'
import type { CompanyCategory } from '@/features/products/categories/types'
import { BulkActionsMenu } from '@/features/products/components/BulkActionsMenu'
import type { ProductStatusFilter, StockStatusFilter } from '@/features/products/types'

/** The toolbar's own widening of `StockStatusFilter` with an "all stock levels" option — the chip
 *  the two "Stock levels" dashboard links don't carry, and the one this filter resets to. */
export type StockLevelFilter = 'all' | StockStatusFilter

export interface ProductsToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  statusFilter: ProductStatusFilter
  onStatusFilterChange: (value: ProductStatusFilter) => void
  /** The dashboard's "Stock levels" cards (`UX_CONSISTENCY_DESIGN_PLAN.md`, Pattern B) deep-link
   *  here instead of to a separate page, so the one Inventory table is the answer either way. */
  stockLevelFilter: StockLevelFilter
  onStockLevelFilterChange: (value: StockLevelFilter) => void
  /**
   * How many products each chip would show under the other filters. Only known when the list is
   * read from the on-device catalogue (A3), which counts them as it filters; omitted otherwise.
   */
  stockLevelCounts?: Record<StockLevelFilter, number>
  /** The company's own categories. The filter is hidden while there are none to pick from. */
  categories: CompanyCategory[]
  /** A category id, or '' for all categories. */
  categoryFilter: string
  onCategoryFilterChange: (categoryId: string) => void
  /** Everything that writes to the catalog needs MANAGE_PRODUCTS; export only needs VIEW_PRODUCTS. */
  canManageProducts: boolean
  /** "Record a delivery" needs MANAGE_INVENTORY — which a storekeeper has without MANAGE_PRODUCTS. */
  canRecordDelivery: boolean
  /**
   * Opens the search-first "Add a product" modal (§7.1 of the multi-vendor inventory design)
   * instead of navigating straight to `/app/products/new` — the duplicate-nudge has to run
   * BEFORE a create form exists to abandon, not inside it.
   */
  onAddProduct: () => void
  onBulkUpload: () => void
  onRecordDelivery: () => void
  /** Opens the list of what has been ordered and not yet received (task 3.1). */
  onExpectedDeliveries: () => void
  onExport: () => void
  onSkuSettings: () => void
  onManageCategories: () => void
}

const statusOptions: { value: ProductStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

// "What do I have, and what's left" (`UX_CONSISTENCY_DESIGN_PLAN.md` Pattern B) is answered on
// this one table via a filter chip, not a second page with its own grid. "Low stock" keeps its
// own bookmarked route (`/app/products/low-stock`) rather than becoming `?stockStatus=LOW` here —
// see `ProductListPage`'s handler — so an existing link to it keeps working unchanged.
const stockLevelOptions: { value: StockLevelFilter; label: string }[] = [
  { value: 'all', label: 'All stock' },
  { value: 'OK', label: 'Well stocked' },
  { value: 'LOW', label: 'Low stock' },
  { value: 'OUT', label: 'Out of stock' },
]

export function ProductsToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  stockLevelFilter,
  onStockLevelFilterChange,
  stockLevelCounts,
  categories,
  categoryFilter,
  onCategoryFilterChange,
  canManageProducts,
  canRecordDelivery,
  onAddProduct,
  onBulkUpload,
  onRecordDelivery,
  onExpectedDeliveries,
  onExport,
  onSkuSettings,
  onManageCategories,
}: ProductsToolbarProps) {
  // Kept on screen while a filter is set, even if the list is empty — otherwise a filter left on a
  // category that was just deleted could not be cleared.
  const showCategoryFilter = categories.length > 0 || categoryFilter !== ''

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <label htmlFor="product-search" className="sr-only">
              Search products
            </label>
            <input
              id="product-search"
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by name or SKU"
              className="w-full rounded-md border border-neutral-200 py-2 pr-3 pl-9 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
            />
          </div>

          {showCategoryFilter && (
            <div className="sm:w-48">
              <label htmlFor="product-category-filter" className="sr-only">
                Filter by category
              </label>
              <select
                id="product-category-filter"
                value={categoryFilter}
                onChange={(e) => onCategoryFilterChange(e.target.value)}
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
        </div>

        <div className="flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-0.5">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={statusFilter === option.value}
              onClick={() => onStatusFilterChange(option.value)}
              className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === option.value
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* The stock-level chips — the Inventory page's own answer to "what do I have and what's
          left", not a separate page. `UX_CONSISTENCY_DESIGN_PLAN.md` Pattern B. */}
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-0.5 sm:self-start">
        {stockLevelOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            // Which chip is on was conveyed by a white background alone; screen readers heard
            // four identical buttons.
            aria-pressed={stockLevelFilter === option.value}
            onClick={() => onStockLevelFilterChange(option.value)}
            className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
              stockLevelFilter === option.value
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {option.label}
            {stockLevelCounts && (
              <span className="ml-1.5 tabular-nums text-neutral-400">{stockLevelCounts[option.value].toLocaleString()}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        {canManageProducts ? (
          <Button type="button" variant="action" onClick={onAddProduct}>
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-2">
          {/*
            One primary action, one daily one, and a menu for the rest. Recording a delivery is
            the thing a storekeeper does every morning; downloading a sheet, editing categories
            and changing SKU settings are things anyone does a handful of times a year, and giving
            those the same weight as "Add Product" made the toolbar a wall of identical buttons
            that each wrapped onto two lines.
          */}
          {canRecordDelivery && (
            <button
              type="button"
              onClick={onRecordDelivery}
              className={`${buttonClassName('secondary')} hidden whitespace-nowrap md:inline-flex`}
            >
              <Truck className="h-4 w-4" />
              Record a delivery
            </button>
          )}
          <BulkActionsMenu
            canManageProducts={canManageProducts}
            canRecordDelivery={canRecordDelivery}
            onBulkUpload={onBulkUpload}
            onRecordDelivery={onRecordDelivery}
            onExpectedDeliveries={onExpectedDeliveries}
            onExport={onExport}
            onSkuSettings={onSkuSettings}
            onManageCategories={onManageCategories}
          />
        </div>
      </div>
    </div>
  )
}
