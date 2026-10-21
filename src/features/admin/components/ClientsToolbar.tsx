import { Search } from 'lucide-react'
import type { ClientStatusFilter } from '@/features/admin/types'

export interface ClientsToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  statusFilter: ClientStatusFilter
  onStatusFilterChange: (value: ClientStatusFilter) => void
  /** Selling from stock: '' any, 'on', 'off' (SELLING_PRICE_PLAN.md §5.5 - the adoption figure). */
  sellingFilter: '' | 'on' | 'off'
  onSellingFilterChange: (value: '' | 'on' | 'off') => void
}

const statusOptions: { value: ClientStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
]

export function ClientsToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sellingFilter,
  onSellingFilterChange,
}: ClientsToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
        <label htmlFor="client-search" className="sr-only">
          Search clients
        </label>
        <input
          id="client-search"
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name or identifier"
          className="w-full rounded-md border border-neutral-200 py-2 pr-3 pl-9 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="client-selling" className="sr-only">
        Selling from stock
      </label>
      <select
        id="client-selling"
        value={sellingFilter}
        onChange={(e) => onSellingFilterChange(e.target.value as '' | 'on' | 'off')}
        className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
      >
        <option value="">Selling: any</option>
        <option value="on">Sells from stock</option>
        <option value="off">Does not sell</option>
      </select>
      <div className="flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-0.5">
        {statusOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onStatusFilterChange(option.value)}
            className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === option.value ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      </div>
    </div>
  )
}
