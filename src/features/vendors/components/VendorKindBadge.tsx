import { BadgeCheck, Store } from 'lucide-react'
import { Badge } from '@/components/Badge'
import type { VendorKind } from '@/features/vendors/types'

export interface VendorKindBadgeProps {
  kind: VendorKind
  className?: string
}

/**
 * The one visual distinction between the two kinds of directory entry, in one place so the list,
 * the detail header and the purchase-history header cannot drift apart.
 *
 * VERIFIED is `info` (navy) with a check mark: it means "ProcurePaddy knows you traded with them",
 * which is a *state of fact* rather than a good outcome — `success` green would read as an
 * endorsement of the supplier, which the platform is not making. EXTERNAL is neutral because a
 * supplier you added yourself is the ordinary case, not a lesser one; greying it out or warning on
 * it would suggest something is wrong with the majority of a real company's supplier list.
 *
 * The icon carries the meaning as well as the colour, because colour alone is not a distinction
 * for a colour-blind reader — and the label is spelled out rather than abbreviated for the same
 * reason.
 */
export function VendorKindBadge({ kind, className = '' }: VendorKindBadgeProps) {
  if (kind === 'VERIFIED') {
    return (
      <Badge variant="info" className={className} title="Added automatically when you bought from this seller on ProcurePaddy">
        <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
        ProcurePaddy seller
      </Badge>
    )
  }

  return (
    <Badge variant="neutral" className={className} title="A supplier your company added itself">
      <Store className="h-3.5 w-3.5" aria-hidden="true" />
      Your own supplier
    </Badge>
  )
}
