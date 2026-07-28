import { Truck } from 'lucide-react'
import { Badge } from '@/components/Badge'

export interface IncomingStockBadgeProps {
  quantity: number
  /** `+12 incoming` in dense rows; `12 incoming — not usable yet` where there is room to be explicit. */
  variant?: 'compact' | 'full'
  className?: string
}

/**
 * The single visual token for stock that is paid for but has not arrived.
 *
 * Three rules, and they are the whole point of the module:
 *   1. **Amber, never emerald.** Emerald in this app means done/good/available. Incoming stock is
 *      none of those — it is *awaited*, the same category as a low-stock warning, so it shares the
 *      warning palette and is instantly distinguishable from anything on hand.
 *   2. **Never merged into the on-hand figure.** It is always a separate token beside the
 *      quantity, never added to it. A product with 0 on hand and 20 incoming must not read as
 *      being in stock, because you cannot sell, pick or use a single one of those 20 today.
 *   3. **The word "incoming" always appears.** A lone amber "+12" invites the reader to guess.
 */
export function IncomingStockBadge({ quantity, variant = 'compact', className = '' }: IncomingStockBadgeProps) {
  if (quantity <= 0) return null

  return (
    <Badge variant="warning" className={className} title="Paid for and on its way. Not usable until you confirm receipt.">
      <Truck className="h-3 w-3" aria-hidden="true" />
      {variant === 'compact' ? `+${quantity} incoming` : `${quantity} incoming — not usable yet`}
    </Badge>
  )
}
