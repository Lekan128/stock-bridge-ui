import { ORDER_STATUS_LABELS, type OrderStatus } from '@/constants/orderStatus'
import type { AdminOrder, AdminOrderSummary } from '@/features/marketplace/types'

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

const PLACEHOLDER = '—'

export function formatDateTime(value?: string | null): string {
  if (!value) return PLACEHOLDER
  return dateTimeFormatter.format(new Date(value))
}

export function formatDate(value?: string | null): string {
  if (!value) return PLACEHOLDER
  return dateFormatter.format(new Date(value))
}

/**
 * "3 hours ago" for the queue, where the operator's real question is "how long has this been
 * sitting there". The absolute timestamp always accompanies it in a `title`, because relative
 * time alone is useless when someone is reading a row back to a customer on the phone.
 */
export function formatRelativeTime(value?: string | null): string {
  if (!value) return PLACEHOLDER
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return PLACEHOLDER

  const diffSeconds = Math.round((then - Date.now()) / 1000)
  const abs = Math.abs(diffSeconds)

  if (abs < 60) return 'just now'
  if (abs < 3600) return relativeFormatter.format(Math.round(diffSeconds / 60), 'minute')
  if (abs < 86400) return relativeFormatter.format(Math.round(diffSeconds / 3600), 'hour')
  if (abs < 2592000) return relativeFormatter.format(Math.round(diffSeconds / 86400), 'day')
  return dateFormatter.format(new Date(value))
}

/** The moment the order entered the queue. `placedAt` is absent while it is still PENDING_PAYMENT. */
export function orderPlacedAt(order: AdminOrderSummary | AdminOrder): string {
  return order.placedAt ?? order.createdAt
}

const AGEING_THRESHOLD_MS = 24 * 60 * 60 * 1000

/** True when an order still needing action has been waiting more than a day — the queue flags it. */
export function isAgeing(order: AdminOrderSummary): boolean {
  if (order.status !== 'PLACED' && order.status !== 'CONFIRMED' && order.status !== 'PROCESSING') return false
  return Date.now() - new Date(orderPlacedAt(order)).getTime() > AGEING_THRESHOLD_MS
}

/** `2026-07-27` → the ISO instant at local midnight; the API's `from` bound is inclusive. */
export function startOfDayIso(date: string): string | undefined {
  if (!date) return undefined
  const parsed = new Date(`${date}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

/** `2026-07-27` → the last millisecond of that local day, so "to: today" includes today. */
export function endOfDayIso(date: string): string | undefined {
  if (!date) return undefined
  const parsed = new Date(`${date}T23:59:59.999`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

export interface StatusAction {
  status: OrderStatus
  label: string
  /** Shown in the confirm step — what this button actually does, in the operator's terms. */
  description: string
  /** Irreversible transitions get a stronger confirm and a warning tone. */
  irreversible: boolean
  variant: 'primary' | 'secondary' | 'danger'
  /** Cancellation without a stated reason is useless to whoever reads the order next. */
  requiresNote: boolean
}

const STATUS_ACTIONS: Record<OrderStatus, StatusAction | null> = {
  CONFIRMED: {
    status: 'CONFIRMED',
    label: 'Confirm order',
    description: 'Tells the customer ProcurePal has accepted the order and will fulfil it.',
    irreversible: false,
    variant: 'primary',
    requiresNote: false,
  },
  PROCESSING: {
    status: 'PROCESSING',
    label: 'Start preparing',
    description: 'Marks the order as being picked and packed in the warehouse.',
    irreversible: false,
    variant: 'primary',
    requiresNote: false,
  },
  OUT_FOR_DELIVERY: {
    status: 'OUT_FOR_DELIVERY',
    label: 'Dispatch',
    description:
      'Releases the goods: stock leaves ProcurePal’s inventory and the customer is told the order is on its way. This cannot be undone.',
    irreversible: true,
    variant: 'primary',
    requiresNote: false,
  },
  DELIVERED: {
    status: 'DELIVERED',
    label: 'Mark delivered',
    description:
      'Records that the goods reached the customer. They still have to confirm receipt themselves before it lands in their inventory.',
    irreversible: false,
    variant: 'primary',
    requiresNote: false,
  },
  CANCELLED: {
    status: 'CANCELLED',
    label: 'Cancel order',
    description:
      'Ends the order and returns any incoming stock to the customer’s books. This cannot be undone.',
    irreversible: true,
    variant: 'danger',
    requiresNote: true,
  },
  // Never offered from this screen:
  // RECEIVED is buyer-driven (the server refuses it here), and nothing walks an order backwards.
  RECEIVED: null,
  PENDING_PAYMENT: null,
  PLACED: null,
}

/**
 * The buttons to render, derived **only** from the server's `allowedNextStatuses`. The single
 * subtraction is RECEIVED: the state machine genuinely allows DELIVERED → RECEIVED, but that
 * transition is the *customer* asserting the goods are in their store (it writes stock into their
 * inventory), and ProcurePal's admin route rejects it. Offering it would be a button that always
 * fails.
 */
export function nextStatusActions(allowedNextStatuses: OrderStatus[]): StatusAction[] {
  return allowedNextStatuses
    .map((status) => STATUS_ACTIONS[status])
    .filter((action): action is StatusAction => action !== null)
}

/** True when the server allows RECEIVED next — the screen explains who may set it instead. */
export function awaitsCustomerReceipt(allowedNextStatuses: OrderStatus[]): boolean {
  return allowedNextStatuses.includes('RECEIVED')
}

export function statusEventLabel(toStatus: OrderStatus, fromStatus?: OrderStatus | null): string {
  const label = ORDER_STATUS_LABELS[toStatus]
  return fromStatus ? label : `${label} · order created`
}
