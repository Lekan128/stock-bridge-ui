import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from '@/constants/orderStatus'

export interface OrderStatusFilterProps {
  value?: OrderStatus
  onChange: (status?: OrderStatus) => void
}

/**
 * A plain <select> rather than a row of chips: eight statuses in a chip row wraps to three lines
 * at 375px and pushes the list below the fold. The backend filter is single-value, so a select is
 * also an honest representation of what the API can actually do.
 */
export function OrderStatusFilter({ value, onChange }: OrderStatusFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="order-status-filter" className="shrink-0 text-sm text-neutral-600">
        Status
      </label>
      <select
        id="order-status-filter"
        value={value ?? ''}
        onChange={(event) => onChange((event.target.value || undefined) as OrderStatus | undefined)}
        className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 sm:w-56"
      >
        <option value="">All orders</option>
        {ORDER_STATUSES.map((status) => (
          <option key={status} value={status}>
            {ORDER_STATUS_LABELS[status]}
          </option>
        ))}
      </select>
    </div>
  )
}
