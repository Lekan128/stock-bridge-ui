import { useEffect } from 'react'
import { PackagePlus, Truck } from 'lucide-react'
import { Button } from '@/components/Button'
import { InventoryActions, type InventoryBarProps } from '@/features/products/components/InventoryBar'

export interface InventoryActionBarProps extends InventoryBarProps {
  /** Selecting on a phone (long press): the bar becomes the selection's own actions. */
  selecting: boolean
  selectedCount: number
  canStockInSelected: boolean
  onStockInSelected: () => void
  /** Multiple branches: "Send" the selection to another branch (MULTI_BRANCH_UX_PLAN.md §5.4). */
  canSendSelected?: boolean
  onSendSelected?: () => void
  onDoneSelecting: () => void
}

const BAR_HEIGHT = '4.5rem'

/**
 * The Inventory list's actions on a phone (C1): pinned to the bottom, in reach of the thumb —
 * Record a delivery, Add product and "⋯"; while selecting, "3 selected · Stock in selected · Done".
 * Publishes its height so toasts rise above it.
 */
export function InventoryActionBar(props: InventoryActionBarProps) {
  const { selecting, selectedCount, canStockInSelected, onStockInSelected, canSendSelected, onSendSelected, onDoneSelecting } = props

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--bottom-bar-height', BAR_HEIGHT)
    return () => {
      root.style.removeProperty('--bottom-bar-height')
    }
  }, [])

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-neutral-200 bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden"
      role="region"
      aria-label={selecting ? 'Selected products' : 'Inventory actions'}
    >
      {selecting ? (
        <>
          <p className="min-w-0 flex-1 text-sm font-medium text-neutral-900 tabular-nums" aria-live="polite">
            {selectedCount} selected
          </p>
          {canStockInSelected && (
            <Button variant="action" onClick={onStockInSelected} disabled={selectedCount === 0}>
              <PackagePlus className="h-4 w-4" aria-hidden="true" />
              Stock in
            </Button>
          )}
          {canSendSelected && onSendSelected && (
            <Button variant={canStockInSelected ? 'secondary' : 'action'} onClick={onSendSelected} disabled={selectedCount === 0}>
              <Truck className="h-4 w-4" aria-hidden="true" />
              Send
            </Button>
          )}
          <Button variant="secondary" onClick={onDoneSelecting}>
            Done
          </Button>
        </>
      ) : (
        <InventoryActions {...props} compact />
      )}
    </div>
  )
}
