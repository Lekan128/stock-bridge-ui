import type { FunnelStatusCount, OrderStatusName } from '@/features/marketplace/analytics/types'

const percentFormatter = new Intl.NumberFormat('en-NG', { style: 'percent', maximumFractionDigits: 1 })
const signedPercentFormatter = new Intl.NumberFormat('en-NG', {
  style: 'percent',
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
})
const dateFormatter = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })

/** A 0..1 server fraction as `62.5%`. */
export function formatShare(fraction: number): string {
  return percentFormatter.format(fraction)
}

export type DeltaDirection = 'up' | 'down' | 'flat' | 'new' | 'none'

export interface Delta {
  direction: DeltaDirection
  /** Ready-to-render label. Never a bare number — always carries its sign or its word. */
  label: string
}

/**
 * Period-over-period change, with the two cases a naive `(a - b) / b` gets wrong.
 *
 * A young marketplace spends most of its life with a zero baseline, where percentage
 * change is undefined rather than infinite. So: zero → something is reported as **New**,
 * zero → zero as **No change**, and only a real baseline produces a percentage. The
 * server deliberately does not compute this — which of those three to show is a
 * presentation decision, not an arithmetic one.
 */
export function computeDelta(current: number, previous: number): Delta {
  if (previous === 0) {
    if (current === 0) return { direction: 'none', label: 'No change' }
    return { direction: 'new', label: 'New this period' }
  }
  const change = (current - previous) / Math.abs(previous)
  if (Math.abs(change) < 0.0005) return { direction: 'flat', label: 'No change' }
  return { direction: change > 0 ? 'up' : 'down', label: signedPercentFormatter.format(change) }
}

/**
 * Hours as an operator would say them. Under a day reads in hours, beyond that in days —
 * "1.8 days" is a sentence somebody can act on; "43.2 hours" is one they have to divide.
 * Undefined (the server omits the field entirely when nothing completed the hop) reads as
 * an em dash, never as `0h`, which would look like instant fulfilment.
 */
export function formatDuration(hours: number | undefined): string {
  if (hours == null || Number.isNaN(hours)) return '—'
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 48) return `${hours.toFixed(1).replace(/\.0$/, '')} hrs`
  return `${(hours / 24).toFixed(1).replace(/\.0$/, '')} days`
}

/** `2026-03-04T09:00:00Z` → `4 Mar 2026`. Undefined reads as an em dash. */
export function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date)
}

/** Whole days since an ISO timestamp — the churn signal on the customer table. */
export function daysSince(iso: string | undefined): number | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000))
}

const STATUS_LABELS: Record<OrderStatusName, string> = {
  PENDING_PAYMENT: 'Awaiting payment',
  PLACED: 'Placed',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
}

export function statusLabel(status: OrderStatusName): string {
  return STATUS_LABELS[status] ?? status
}

const STAGE_LABELS: Record<string, string> = {
  PLACED: 'Placed',
  CONFIRMED: 'Confirmed',
  DISPATCHED: 'Dispatched',
  DELIVERED: 'Delivered',
  RECEIVED: 'Received',
}

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage
}

/** `PLACED_TO_CONFIRMED` → `Placed → Confirmed`. */
export function transitionLabel(fromStage: string, toStage: string): string {
  return `${stageLabel(fromStage)} → ${stageLabel(toStage)}`
}

/**
 * Which statuses to draw, in fulfilment order, keeping the terminal/failure ones last so
 * the census reads as a pipeline rather than an alphabetical list.
 */
export const STATUS_ORDER: OrderStatusName[] = [
  'PENDING_PAYMENT',
  'PLACED',
  'CONFIRMED',
  'PROCESSING',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'RECEIVED',
  'CANCELLED',
]

export function sortStatusCounts(counts: FunnelStatusCount[]): FunnelStatusCount[] {
  return [...counts].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))
}
