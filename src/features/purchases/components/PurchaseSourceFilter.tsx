import type { PurchaseSource } from '@/features/purchases/types'

export type SourceFilter = 'all' | PurchaseSource

const OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'MARKETPLACE_ORDER', label: 'Marketplace orders' },
  { value: 'MANUAL_STOCK_IN', label: 'Manual stock-ins' },
]

/** The segmented control both purchase-history screens use to split the two ledgers apart. */
export function PurchaseSourceFilter({
  value,
  onChange,
}: {
  value: SourceFilter
  onChange: (value: SourceFilter) => void
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-neutral-200 bg-white p-1">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`rounded-sm px-2.5 py-1.5 text-sm font-medium transition-colors ${
            value === option.value ? 'bg-primary-50 text-primary-700' : 'text-neutral-600 hover:bg-neutral-50'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
