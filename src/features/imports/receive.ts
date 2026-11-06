import { lineKey, parseAmount, quantityUnitWord } from '@/features/imports/delivery'
import type { DeliveryLine, DeliveryLineInput, SendBackReason } from '@/features/imports/types'
import { formatQuantity } from '@/features/expected/expected'

/**
 * One line of Record a delivery (PURCHASE_ORDER_PLAN.md section 11.6): what was ordered beside what
 * arrived, and how many of those went back with the driver.
 */
export interface ReceiveRow {
  line: DeliveryLine
  /** Still owed on the order being received; null for a line that isn't on it. */
  ordered: number | null
  /** The order's price for ONE of the unit; null when not on the order or not priced. */
  orderPrice: number | null
  /** As typed. Starts at what was ordered (owner, 2026-11-06). */
  arrived: string
  /** As typed. Empty means "the last price paid". */
  price: string
  back: SendBack
}

export interface SendBack {
  open: boolean
  quantity: string
  reason: SendBackReason | null
  note: string
}

export const NO_BACK: SendBack = { open: false, quantity: '', reason: null, note: '' }

export function rowKey(row: ReceiveRow): string {
  return lineKey(row.line)
}

/** A typed number of 0 or more, or null (blank or not a number). */
export function amount(text: string): number | null {
  const value = parseAmount(text)
  return value != null && Number.isFinite(value) && value >= 0 ? value : null
}

export function invalidAmount(text: string): boolean {
  return text.trim() !== '' && amount(text) == null
}

export function arrivedOf(row: ReceiveRow): number {
  return amount(row.arrived) ?? 0
}

export function backOf(row: ReceiveRow): number {
  return row.back.open ? (amount(row.back.quantity) ?? 0) : 0
}

/** What goes into stock: what came, less what went back. */
export function takenOf(row: ReceiveRow): number {
  return Math.max(0, arrivedOf(row) - backOf(row))
}

/** "20 bags", "1 kg" — a quantity in the line's own unit word. */
export function words(row: Pick<ReceiveRow, 'line'>, quantity: number): string {
  return `${formatQuantity(quantity)} ${quantityUnitWord(row.line, quantity)}`
}

/** The price the line goes in at: typed, else the order's, else the last paid. */
export function priceOf(row: ReceiveRow): number | null {
  const typed = amount(row.price)
  if (typed != null) return typed
  return row.orderPrice ?? row.line.lastPrice ?? null
}

/** A sent-back box that can't be sent: more than arrived, a reason missing, or "Other" with nothing said. */
export function backProblem(row: ReceiveRow): 'tooMany' | 'why' | 'note' | 'number' | null {
  if (!row.back.open) return null
  if (invalidAmount(row.back.quantity)) return 'number'
  const back = amount(row.back.quantity) ?? 0
  if (back === 0) return null
  if (back > arrivedOf(row)) return 'tooMany'
  if (row.back.reason == null) return 'why'
  if (row.back.reason === 'OTHER' && row.back.note.trim() === '') return 'note'
  return null
}

export interface ReceiveTally {
  lines: DeliveryLineInput[]
  /** Lines with anything at all arriving. */
  count: number
  short: number
  /** "3 bags rice, 2 kg beans" going back. */
  goingBack: string[]
  invalid: boolean
}

export function tallyRows(rows: ReceiveRow[]): ReceiveTally {
  const tally: ReceiveTally = { lines: [], count: 0, short: 0, goingBack: [], invalid: false }
  for (const row of rows) {
    if (invalidAmount(row.arrived) || invalidAmount(row.price) || backProblem(row) != null) tally.invalid = true
    const arrived = arrivedOf(row)
    if (row.ordered != null && arrived < row.ordered) tally.short += 1
    if (arrived <= 0) continue
    tally.count += 1
    const back = backOf(row)
    const price = amount(row.price) ?? row.orderPrice ?? undefined
    const input: DeliveryLineInput = {
      productId: row.line.productId,
      unit: row.line.unit,
      quantity: Math.max(0, arrived - back),
      ...(price != null ? { price } : {}),
    }
    if (back > 0 && row.back.reason) {
      input.sentBack = back
      input.sentBackReason = row.back.reason
      if (row.back.note.trim() !== '') input.sentBackNote = row.back.note.trim()
      tally.goingBack.push(`${words(row, back)} of ${row.line.productName.toLowerCase()}`)
    }
    tally.lines.push(input)
  }
  return tally
}
