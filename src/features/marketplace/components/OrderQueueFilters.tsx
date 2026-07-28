import { RotateCw, Search, X } from 'lucide-react'
import { PAYMENT_STATUSES, PAYMENT_STATUS_LABELS, type OrderStatus, type PaymentStatus } from '@/constants/orderStatus'
import type { OrderQueueCounts } from '@/features/marketplace/hooks/useOrderQueueCounts'

export type QueueStatusFilter = OrderStatus | 'ALL'
export type QueuePaymentFilter = PaymentStatus | 'ALL'

/**
 * Queue-specific labels, not the generic `ORDER_STATUS_LABELS`. On a pill row the operator is
 * choosing a *worklist*, so "New" and "Preparing" read better than "Order placed" and
 * "Being prepared" — the badge inside each row still uses the canonical wording.
 */
const STATUS_TABS: { value: QueueStatusFilter; label: string; hint: string }[] = [
  { value: 'PLACED', label: 'New', hint: 'Placed and waiting for ProcurePal to confirm' },
  { value: 'CONFIRMED', label: 'Confirmed', hint: 'Confirmed, not yet being picked' },
  { value: 'PROCESSING', label: 'Preparing', hint: 'Being picked and packed' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for delivery', hint: 'Dispatched, with the rider' },
  { value: 'DELIVERED', label: 'Delivered', hint: 'Delivered, awaiting the customer’s receipt' },
  { value: 'PENDING_PAYMENT', label: 'Awaiting payment', hint: 'Checkout started, payment not completed' },
  { value: 'RECEIVED', label: 'Received', hint: 'Closed — the customer took the goods into stock' },
  { value: 'CANCELLED', label: 'Cancelled', hint: 'Cancelled by the customer or by ProcurePal' },
  { value: 'ALL', label: 'All orders', hint: 'Every order, in any state' },
]

export interface OrderQueueFiltersProps {
  status: QueueStatusFilter
  onStatusChange: (status: QueueStatusFilter) => void
  counts: OrderQueueCounts
  paymentStatus: QueuePaymentFilter
  onPaymentStatusChange: (paymentStatus: QueuePaymentFilter) => void
  search: string
  onSearchChange: (search: string) => void
  from: string
  to: string
  onDateRangeChange: (range: { from: string; to: string }) => void
  hasActiveFilters: boolean
  onReset: () => void
  onRefresh: () => void
  refreshing: boolean
}

export function OrderQueueFilters({
  status,
  onStatusChange,
  counts,
  paymentStatus,
  onPaymentStatusChange,
  search,
  onSearchChange,
  from,
  to,
  onDateRangeChange,
  hasActiveFilters,
  onReset,
  onRefresh,
  refreshing,
}: OrderQueueFiltersProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Status worklists. Horizontally scrollable rather than wrapped, so the row keeps one
          predictable height and the leading (most urgent) tabs never move. */}
      {/* Toggle buttons rather than a tablist: these filter the list below, they do not swap
          between panels, and announcing them as tabs would promise a relationship that is not
          there. `aria-pressed` says exactly what is true — this filter is on. */}
      <div
        role="group"
        aria-label="Filter orders by status"
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
      >
        {STATUS_TABS.map((tab) => {
          const selected = tab.value === status
          const count = counts[tab.value]
          const isNew = tab.value === 'PLACED'

          return (
            <button
              key={tab.value}
              type="button"
              aria-pressed={selected}
              title={tab.hint}
              onClick={() => onStatusChange(tab.value)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none ${
                selected
                  ? 'border-primary-600 bg-primary-600 text-white'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {isNew && !selected && (count ?? 0) > 0 && (
                <span className="h-2 w-2 shrink-0 rounded-full bg-warning-500" aria-hidden="true" />
              )}
              {tab.label}
              {count !== undefined && (
                <span
                  className={`rounded-sm px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
                    selected
                      ? 'bg-white/20 text-white'
                      : isNew && count > 0
                        ? 'bg-warning-100 text-warning-800'
                        : 'bg-neutral-100 text-neutral-600'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3 lg:flex-row lg:items-end lg:gap-4">
        <div className="flex-1">
          <label htmlFor="queue-search" className="mb-1.5 block text-xs font-medium text-neutral-500">
            Customer or order number
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400"
              aria-hidden="true"
            />
            <input
              id="queue-search"
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="e.g. Demo Retail Co or PP-2026-0001"
              className="w-full rounded-md border border-neutral-200 py-2 pr-3 pl-9 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
            />
          </div>
        </div>

        <div className="sm:w-48">
          <label htmlFor="queue-payment" className="mb-1.5 block text-xs font-medium text-neutral-500">
            Payment
          </label>
          <select
            id="queue-payment"
            value={paymentStatus}
            onChange={(event) => onPaymentStatusChange(event.target.value as QueuePaymentFilter)}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
          >
            <option value="ALL">Any payment status</option>
            {PAYMENT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {PAYMENT_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="queue-from" className="mb-1.5 block text-xs font-medium text-neutral-500">
              Placed from
            </label>
            <input
              id="queue-from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => onDateRangeChange({ from: event.target.value, to })}
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="queue-to" className="mb-1.5 block text-xs font-medium text-neutral-500">
              Placed to
            </label>
            <input
              id="queue-to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => onDateRangeChange({ from, to: event.target.value })}
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span className="lg:sr-only">Refresh</span>
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
