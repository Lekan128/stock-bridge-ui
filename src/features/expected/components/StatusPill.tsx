import { expectedCopy } from '@/features/expected/copy'
import type { OrderStatus } from '@/features/expected/orderStatus'

const words = expectedCopy.rows
const LOOK: Record<OrderStatus, { label: string; className: string }> = {
  toApprove: { label: words.pillToApprove, className: 'bg-warning-100 text-warning-800' },
  changeAsked: { label: words.pillChangeAsked, className: 'bg-neutral-100 text-neutral-700' },
  notSent: { label: words.pillNotSent, className: 'bg-primary-50 text-primary-700' },
  changed: { label: words.pillChanged, className: 'bg-primary-50 text-primary-700' },
  sent: { label: words.pillSent, className: 'bg-neutral-100 text-neutral-700' },
  byPhone: { label: words.pillByPhone, className: 'bg-neutral-100 text-neutral-700' },
  part: { label: words.pillPart, className: 'bg-warning-100 text-warning-800' },
  late: { label: words.pillLate, className: 'bg-warning-100 text-warning-800' },
  arrived: { label: words.pillArrived, className: 'bg-accent-50 text-accent-800' },
  calledOff: { label: words.pillCalledOff, className: 'bg-neutral-100 text-neutral-600' },
  closed: { label: words.pillClosed, className: 'bg-neutral-100 text-neutral-700' },
}

/** The status as a small pill with a dot: the word carries it, so colour is never the only signal. */
export function StatusPill({ status }: { status: OrderStatus }) {
  const look = LOOK[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${look.className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {look.label}
    </span>
  )
}
