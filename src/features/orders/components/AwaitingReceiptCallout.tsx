import { PackageCheck } from 'lucide-react'

export interface AwaitingReceiptCalloutProps {
  count: number
  /** Filters the list down to the delivered orders. */
  onShowDelivered: () => void
  /** True when the list is already filtered to DELIVERED — the button would then be a no-op. */
  filterActive: boolean
}

/**
 * The buyer's one outstanding action, hoisted above the list.
 *
 * Confirming receipt is not administrative tidying: until it happens the goods sit in inventory
 * as *incoming* and cannot be used or sold. That consequence is stated here in plain words,
 * because "you have 2 delivered orders" does not tell anyone why they should care.
 */
export function AwaitingReceiptCallout({ count, onShowDelivered, filterActive }: AwaitingReceiptCalloutProps) {
  if (count === 0) return null

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-warning-200 bg-warning-50 p-4 sm:flex-row sm:items-center">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning-100 text-warning-700">
        <PackageCheck className="h-4.5 w-4.5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-warning-900">
          {count} {count === 1 ? 'delivery is' : 'deliveries are'} waiting for you to confirm receipt
        </p>
        <p className="mt-0.5 text-sm text-warning-800">
          These goods are already in your inventory as <strong>incoming stock</strong> — they will not count as
          usable stock until you confirm what actually arrived.
        </p>
      </div>
      {!filterActive && (
        <button
          type="button"
          onClick={onShowDelivered}
          className="shrink-0 rounded-md border border-warning-300 bg-white px-3 py-2 text-sm font-medium text-warning-900 hover:bg-warning-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning-500"
        >
          Show them
        </button>
      )}
    </div>
  )
}
