import { StatusTimeline, type StatusTimelineEntry } from '@/components/StatusTimeline'
import { ORDER_STATUS_LABELS, ORDER_STATUS_SEQUENCE, isTerminalOrderStatus } from '@/constants/orderStatus'
import { formatOrderDateTime } from '@/features/orders/formatters'
import type { Order } from '@/features/orders/types'

/**
 * Turns `order_status_events` into timeline entries, then pads the tail with the steps that have
 * not happened yet — so a buyer sees the whole journey and where in it their order sits, rather
 * than a list that stops dead at "confirmed" with no hint of what comes next.
 *
 * A cancelled order gets no upcoming steps: CANCELLED is a terminal branch off the sequence, not
 * a position within it, and drawing "out for delivery" below it would be nonsense.
 */
function buildEntries(order: Order): StatusTimelineEntry[] {
  const entries: StatusTimelineEntry[] = order.events.map((event, index) => ({
    id: event.id,
    label: ORDER_STATUS_LABELS[event.toStatus],
    timestamp: formatOrderDateTime(event.createdAt),
    note: event.note,
    state:
      event.toStatus === 'CANCELLED'
        ? 'cancelled'
        : index === order.events.length - 1
          ? 'current'
          : 'complete',
  }))

  // Defensive: an order always has at least a creation event, but a truncated payload must not
  // render an empty panel where the tracking is supposed to be.
  if (entries.length === 0) {
    entries.push({
      id: order.id,
      label: ORDER_STATUS_LABELS[order.status],
      timestamp: formatOrderDateTime(order.placedAt ?? order.createdAt),
      state: isTerminalOrderStatus(order.status) ? 'complete' : 'current',
    })
  }

  if (!isTerminalOrderStatus(order.status)) {
    const position = ORDER_STATUS_SEQUENCE.indexOf(order.status)
    for (const upcoming of ORDER_STATUS_SEQUENCE.slice(position + 1)) {
      entries.push({
        id: `upcoming-${upcoming}`,
        label: ORDER_STATUS_LABELS[upcoming],
        state: 'upcoming',
      })
    }
  }

  return entries
}

export function OrderTimeline({ order }: { order: Order }) {
  return <StatusTimeline entries={buildEntries(order)} />
}
