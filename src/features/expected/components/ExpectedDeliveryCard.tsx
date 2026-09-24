import { Link } from 'react-router-dom'
import { Truck } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { buttonClassName } from '@/components/Button'
import { expectedCopy } from '@/features/expected/copy'
import { isOverdue } from '@/features/expected/expected'
import type { ExpectedDelivery } from '@/features/expected/types'
import { formatPrice } from '@/features/imports/delivery'

export interface ExpectedDeliveryCardProps {
  expected: ExpectedDelivery
  /** Opens the confirm dialog. Nothing is called off from this component itself. */
  onCancel: (expected: ExpectedDelivery) => void
}

/**
 * One thing that is coming.
 *
 * A card rather than a table row because this list is read on a phone, usually standing up, and
 * the question being asked of it is "is this the one that just turned up?" — so the server's own
 * title leads, the count of what is still owed sits under it, and the one button that matters is
 * full width and thumb-high.
 *
 * Late is shown three ways — a tinted left edge, a badge, and a word only a screen reader hears —
 * because a colour on its own is not a statement, and this is the single fact on the card that
 * changes what somebody does next.
 */
export function ExpectedDeliveryCard({ expected, onCancel }: ExpectedDeliveryCardProps) {
  const overdue = isOverdue(expected)
  const open = expected.status === 'OPEN'

  return (
    <li
      className={`flex flex-col gap-3 rounded-lg border bg-white p-4 ${
        overdue ? 'border-warning-200 border-l-4 border-l-warning-500' : 'border-neutral-200'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-neutral-900">
            {expected.title}
            {overdue && <span className="sr-only"> — {expectedCopy.list.overdueAria}</span>}
          </h3>
          <p className="mt-0.5 text-sm text-neutral-600">
            {expected.outstandingLines > 0
              ? expectedCopy.list.outstanding(expected.outstandingLines)
              : expectedCopy.list.nothingOutstanding}
            {expected.total != null && ` · ${expectedCopy.list.totalLabel(formatPrice(expected.total))}`}
          </p>
          {expected.reference != null && (
            <p className="mt-0.5 truncate text-xs text-neutral-500">
              {expectedCopy.list.reference(expected.reference)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {overdue && <Badge variant="warning">{expectedCopy.list.overdue}</Badge>}
          {expected.status === 'RECEIVED' && <Badge variant="success">{expectedCopy.list.statusReceived}</Badge>}
          {expected.status === 'CANCELLED' && <Badge variant="neutral">{expectedCopy.list.statusCancelled}</Badge>}
        </div>
      </div>

      {expected.note != null && <p className="text-sm text-neutral-600">{expected.note}</p>}

      {(expected.receivable || open) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/*
            A link, not a button with a navigate(): receiving is a place, and somebody who wants
            it in another tab — the gate phone's browser very much included — should get one.
          */}
          {expected.receivable && (
            <Link
              to={`/app/products/receive?expected=${expected.id}`}
              aria-label={expectedCopy.list.receiveLabel(expected.title)}
              className={buttonClassName('primary', 'w-full sm:w-auto')}
            >
              <Truck className="h-4 w-4" aria-hidden="true" />
              {expectedCopy.list.receive}
            </Link>
          )}
          {open && (
            <button
              type="button"
              onClick={() => onCancel(expected)}
              aria-label={expectedCopy.list.cancelLabel(expected.title)}
              className={buttonClassName('secondary', 'w-full sm:w-auto')}
            >
              {expectedCopy.list.cancel}
            </button>
          )}
        </div>
      )}
    </li>
  )
}
