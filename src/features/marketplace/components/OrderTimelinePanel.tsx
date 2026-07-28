import { StatusTimeline, type StatusTimelineEntry } from '@/components/StatusTimeline'
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/constants/orderStatus'
import { formatDateTime } from '@/features/marketplace/formatters'
import type { AdminOrder } from '@/features/marketplace/types'

/**
 * Timestamps kept as columns on the order itself. Used only as a fallback: an order that predates
 * the status-event table (or whose events failed to load) still has these, and a timeline built
 * from them is far better than an empty box on a fulfilment screen.
 */
const TIMESTAMP_STEPS: { status: OrderStatus; key: keyof AdminOrder }[] = [
  { status: 'PLACED', key: 'placedAt' },
  { status: 'CONFIRMED', key: 'confirmedAt' },
  { status: 'OUT_FOR_DELIVERY', key: 'dispatchedAt' },
  { status: 'DELIVERED', key: 'deliveredAt' },
  { status: 'RECEIVED', key: 'receivedAt' },
  { status: 'CANCELLED', key: 'cancelledAt' },
]

function fromEvents(order: AdminOrder): StatusTimelineEntry[] {
  // The API returns events oldest-first; the newest one is where the order stands right now.
  return order.events.map((event, index) => {
    const isLast = index === order.events.length - 1
    return {
      id: event.id,
      label: ORDER_STATUS_LABELS[event.toStatus],
      timestamp: formatDateTime(event.createdAt),
      note: event.note ?? null,
      state: event.toStatus === 'CANCELLED' ? 'cancelled' : isLast ? 'current' : 'complete',
    }
  })
}

function fromTimestamps(order: AdminOrder): StatusTimelineEntry[] {
  return TIMESTAMP_STEPS.filter((step) => Boolean(order[step.key])).map((step, index, all) => ({
    id: step.status,
    label: ORDER_STATUS_LABELS[step.status],
    timestamp: formatDateTime(order[step.key] as string),
    state: step.status === 'CANCELLED' ? 'cancelled' : index === all.length - 1 ? 'current' : 'complete',
  }))
}

/** The order's history, as the buyer also sees it — every note written here reaches the customer. */
export function OrderTimelinePanel({ order }: { order: AdminOrder }) {
  const entries = order.events.length > 0 ? fromEvents(order) : fromTimestamps(order)

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4" aria-labelledby="history-heading">
      <h2 id="history-heading" className="text-sm font-semibold text-neutral-900">
        History
      </h2>

      {entries.length > 0 ? (
        <StatusTimeline entries={entries} className="mt-4" />
      ) : (
        <p className="mt-3 text-sm text-neutral-500">
          Nothing has happened to this order yet beyond its creation.
        </p>
      )}

      {order.cancellationReason && (
        <p className="mt-4 rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          Cancellation reason: {order.cancellationReason}
        </p>
      )}
    </section>
  )
}
