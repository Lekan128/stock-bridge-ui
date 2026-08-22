import { CircleCheck, CircleX, Clock } from 'lucide-react'
import { Badge, type BadgeVariant } from '@/components/Badge'
import type { ApprovalStatus } from '@/features/vendor/types'

const PRESENTATION: Record<ApprovalStatus, { label: string; variant: BadgeVariant; Icon: typeof Clock }> = {
  // Warning, not neutral: PENDING is not a resting state, it is a listing that is not on sale
  // yet. Painting it grey would let a seller scroll past a product that is earning nothing.
  PENDING: { label: 'In review', variant: 'warning', Icon: Clock },
  APPROVED: { label: 'Approved', variant: 'success', Icon: CircleCheck },
  REJECTED: { label: 'Rejected', variant: 'danger', Icon: CircleX },
}

/**
 * Where a listing stands with platform moderation.
 *
 * Wording matters here and is not a direct echo of the enum: the server's PENDING becomes
 * "In review", because "Pending" reads to a seller as something THEY have not finished, and
 * the truthful message is that somebody else is looking at it. APPROVED and REJECTED are
 * unambiguous and keep their own words.
 *
 * Deliberately never rendered alone. A REJECTED badge with no reason beside it is the single
 * most common way this screen could produce a support ticket — see `VendorCataloguePage`,
 * which pairs it with the rejection reason and the way back in.
 */
export function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  const { label, variant, Icon } = PRESENTATION[status]
  return (
    <Badge variant={variant}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </Badge>
  )
}
