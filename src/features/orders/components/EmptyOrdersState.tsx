import { FilterX, ShoppingBag } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, buttonClassName } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/constants/orderStatus'

export interface EmptyOrdersStateProps {
  /** The active status filter, or undefined when the list is genuinely unfiltered. */
  status?: OrderStatus
  onClearFilter: () => void
}

/**
 * "Nothing here yet" and "nothing matches this filter" are different problems with different
 * fixes, and the UX bar requires them to read differently — one sends you to the catalog, the
 * other just clears the filter.
 */
export function EmptyOrdersState({ status, onClearFilter }: EmptyOrdersStateProps) {
  if (status) {
    return (
      <EmptyState
        icon={FilterX}
        title={`No ${ORDER_STATUS_LABELS[status].toLowerCase()} orders`}
        description="Nothing matches this filter right now. Clear it to see every order your company has placed."
        action={
          <Button variant="secondary" onClick={onClearFilter}>
            Show all orders
          </Button>
        }
      />
    )
  }

  return (
    <EmptyState
      icon={ShoppingBag}
      title="No orders yet"
      description="When your company buys from ProcurePal, the order appears here — and the goods appear in your inventory as incoming stock until you confirm you have received them."
      action={
        <Link to="/" className={buttonClassName('primary')}>
          Browse the catalog
        </Link>
      }
    />
  )
}
