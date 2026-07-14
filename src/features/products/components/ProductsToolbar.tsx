import { Download, FileSpreadsheet, Plus, Search, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buttonClassName } from '@/components/Button'
import { BulkActionsMenu } from '@/features/products/components/BulkActionsMenu'
import type { ProductStatusFilter } from '@/features/products/types'

export interface ProductsToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  statusFilter: ProductStatusFilter
  onStatusFilterChange: (value: ProductStatusFilter) => void
  onBulkUpload: () => void
  onDownloadTemplate: () => void
  onExport: () => void
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
  onBulkUpload,
  onDownloadTemplate,
  onExport,
}: ProductsToolbarProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        <Link to="/products/new" className={buttonClassName('primary')}>
          <Plus className="h-4 w-4" />
          Add Product
        </Link>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 md:flex">
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
              onClick={onDownloadTemplate}
              className={buttonClassName('secondary')}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Download Template
            </button>
            <button type="button" onClick={onExport} className={buttonClassName('secondary')}>
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
          <BulkActionsMenu onBulkUpload={onBulkUpload} onDownloadTemplate={onDownloadTemplate} onExport={onExport} />
        </div>
      </div>
    </div>
  )
}
