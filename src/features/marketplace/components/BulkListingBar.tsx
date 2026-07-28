import { EyeOff, Globe, X } from 'lucide-react'
import { Button } from '@/components/Button'

export interface BulkListingBarProps {
  selectedCount: number
  onList: () => void
  onUnlist: () => void
  onClear: () => void
  submitting: boolean
}

/**
 * The bulk action bar for the catalog selection.
 *
 * It is sticky at the bottom of the viewport rather than parked above the table: on a 149-product
 * catalog the operator selects rows on the way down the page, and an action bar they have to
 * scroll back up to reach is an action bar they stop using.
 */
export function BulkListingBar({ selectedCount, onList, onUnlist, onClear, submitting }: BulkListingBarProps) {
  if (selectedCount === 0) return null

  return (
    <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-lg border border-primary-200 bg-white p-3 shadow-lg sm:flex-row sm:items-center sm:justify-between">
      <p aria-live="polite" className="text-sm font-medium text-neutral-900">
        {selectedCount} product{selectedCount === 1 ? '' : 's'} selected
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onList} loading={submitting} className="flex-1 sm:flex-none">
          <Globe className="h-4 w-4" />
          List on storefront
        </Button>
        <Button variant="secondary" onClick={onUnlist} disabled={submitting} className="flex-1 sm:flex-none">
          <EyeOff className="h-4 w-4" />
          Unlist
        </Button>
        <button
          type="button"
          onClick={onClear}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-50 disabled:opacity-60"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Clear
        </button>
      </div>
    </div>
  )
}
