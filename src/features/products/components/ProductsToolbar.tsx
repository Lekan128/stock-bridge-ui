import { CalendarClock, Download, Plus, Search, Settings, Tags, Truck, Upload } from 'lucide-react'
import { Button, buttonClassName } from '@/components/Button'
import type { CompanyCategory } from '@/features/products/categories/types'
import { BulkActionsMenu } from '@/features/products/components/BulkActionsMenu'
import type { ProductStatusFilter } from '@/features/products/types'

export interface ProductsToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  statusFilter: ProductStatusFilter
  onStatusFilterChange: (value: ProductStatusFilter) => void
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

export function ProductsToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
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

      <div className="flex items-center justify-between gap-2">
        {canManageProducts ? (
          <Button type="button" onClick={onAddProduct}>
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 md:flex">
            {canRecordDelivery && (
              <>
                <button type="button" onClick={onRecordDelivery} className={buttonClassName('secondary')}>
                  <Truck className="h-4 w-4" />
                  Record a delivery
                </button>
                <button type="button" onClick={onExpectedDeliveries} className={buttonClassName('secondary')}>
                  <CalendarClock className="h-4 w-4" />
                  Expected deliveries
                </button>
              </>
            )}
            {canManageProducts && (
              <>
                <button
                  type="button"
                  onClick={onBulkUpload}
                  className={buttonClassName('secondary')}
                >
                  <Upload className="h-4 w-4" />
                  Bulk Upload
                </button>
                <button
                  type="button"
                  onClick={onManageCategories}
                  className={buttonClassName('secondary')}
                >
                  <Tags className="h-4 w-4" />
                  Categories
                </button>
                <button
                  type="button"
                  onClick={onSkuSettings}
                  className={buttonClassName('secondary')}
                >
                  <Settings className="h-4 w-4" />
                  SKU Settings
                </button>
              </>
            )}
            <button type="button" onClick={onExport} className={buttonClassName('secondary')}>
              <Download className="h-4 w-4" />
              Download my products
            </button>
          </div>
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
