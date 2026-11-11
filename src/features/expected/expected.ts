import { formatNaira, formatNairaWhole } from '@/utils/money'
import { lineKey, quantityUnitWord, type DeliveryEntry } from '@/features/imports/delivery'
import type { DeliveryLine } from '@/features/imports/types'
import type { ExpectedDelivery, ExpectedDeliveryLine } from '@/features/expected/types'
import type { CompanyVendor } from '@/features/vendors/types'

/**
 * The expected-delivery screens' arithmetic, kept out of the pages so the pages are only layout
 * and requests — the same split `features/imports/delivery.ts` makes.
 */

/** Today in the user's own timezone, as the `YYYY-MM-DD` a date input holds. */
export function todayIso(): string {
  return new Date().toLocaleDateString('en-CA')
}

/**
 * Past its date and still owed.
 *
 * A date in the past is not a mistake and is never refused — a supplier who said Tuesday and has
 * not come is exactly what this list exists to show. It is only worth flagging while the record
 * is still OPEN: something that arrived a week after it was promised is finished business, and
 * painting it red on the "All" view would make a closed record look like a live problem.
 *
 * Compared as ISO text rather than as Date objects on purpose: `expectedDate` is a calendar day
 * with no time and no zone, and `new Date('2026-09-22')` is midnight UTC, which is the previous
 * day for anyone west of Greenwich.
 */
export function isOverdue(expected: ExpectedDelivery, today: string = todayIso()): boolean {
  return expected.status === 'OPEN' && expected.expectedDate != null && expected.expectedDate < today
}

/**
 * True when `comesIn` describes a pack rather than the product's own unit.
 *
 * The server writes these labels (`SheetUnitOptions.comesInLabel`) in exactly two shapes: a pack
 * is a container and a size — "Bag · 50 kg", "Pack · 10 pieces" — and everything else is the
 * stock unit alone: "Loose · kg", "Piece", "Units". So a numeric tail is the pack, and that is
 * the whole rule.
 *
 * It is a reading of a label rather than a field because an expected line has no pack flag on the
 * wire, and the one thing this answers — "a bag" versus "per kg" in the price sentence — is only
 * ever asked of a line the delivery picker also returned, which carries the real flag. This is
 * the fallback for the other case: a line whose product the current picker is not listing.
 */
export function looksLikePack(comesIn: string): boolean {
  const tail = comesIn.split(' · ').slice(1).join(' · ').trim()
  return /^\d/.test(tail)
}

/**
 * An expected line as the delivery picker's own line, so a quantity typed against it can be
 * tallied and posted like any other.
 *
 * The product may have been renamed since the order was placed; the server already resolved that
 * against the live catalog before sending, so these words are current.
 */
export function asDeliveryLine(line: ExpectedDeliveryLine): DeliveryLine {
  return {
    productId: line.productId,
    productName: line.productName,
    sku: line.sku,
    unit: line.unit,
    comesIn: line.comesIn,
    pack: looksLikePack(line.comesIn),
    lastPrice: line.price,
  }
}

/**
 * What "Receive this" fills the delivery screen in with: every line that is still owed, at the
 * quantity still owed, at the price that was agreed.
 *
 * Lines already received in full are left out rather than filled in with a zero — a quantity box
 * reading 0 is indistinguishable from one somebody cleared, and the delivery screen treats blank
 * and zero alike as "not this one" anyway.
 *
 * The price opens as an input (`editingPrice`) whenever the order named one, because the agreed
 * price is a fact about *this* delivery that the storekeeper may well have to correct at the
 * gate — and a pre-filled number behind a "Change" link is a number nobody checks.
 */
export function outstandingEntries(expected: ExpectedDelivery): Record<string, DeliveryEntry> {
  const entries: Record<string, DeliveryEntry> = {}
  for (const line of expected.lines) {
    if (!(line.outstanding > 0)) continue
    const delivery = asDeliveryLine(line)
    entries[lineKey(delivery)] = {
      line: delivery,
      quantity: String(line.outstanding),
      price: line.price == null ? '' : String(line.price),
      editingPrice: line.price != null,
    }
  }
  return entries
}

/**
 * Each line of the order being received, by the delivery screen's `lineKey`, with what to say beside
 * its quantity box: "5 bags ordered", or "12 bags still to come · 8 arrived" on a part-arrived order.
 */
export function orderedByKey(expected: ExpectedDelivery): Map<string, string> {
  const notes = new Map<string, string>()
  for (const line of expected.lines) {
    const amount = (value: number) => quantityWords(value, line.comesIn).replace(/ \(.*\)$/, '')
    notes.set(
      lineKey(asDeliveryLine(line)),
      line.receivedQuantity > 0
        ? `${amount(line.outstanding)} still to come · ${amount(line.receivedQuantity)} arrived`
        : `${amount(line.quantity)} ordered`,
    )
  }
  return notes
}

// ---------------------------------------------------------------------- purchase orders ----------

const TIME = new Intl.DateTimeFormat('en-NG', { hour: 'numeric', minute: '2-digit' })
const SHORT_DATE = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short' })

/**
 * When something happened, said the way a person would: "just now", "today at 2:15 pm", "yesterday
 * at 4:02 pm", "2 Nov, 9:30 am". The order page uses it to answer "did I send it?" a week later
 * without a timestamp that reads like a log.
 */
export function whenText(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''
  if (now.getTime() - then.getTime() < 60_000) return 'just now'
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const time = TIME.format(then).toLowerCase()
  if (sameDay(then, now)) return `today at ${time}`
  if (sameDay(then, yesterday)) return `yesterday at ${time}`
  return `${SHORT_DATE.format(then)}, ${time}`
}

/** "12 Nov" from the `YYYY-MM-DD` a supplier date arrives as, without a timezone shifting the day. */
export function shortDate(isoDay: string): string {
  const [year, month, day] = isoDay.split('-').map(Number)
  if (!year || !month || !day) return isoDay
  return SHORT_DATE.format(new Date(year, month - 1, day))
}

/** True when something happened less than `minutes` ago — used to ask before sending twice. */
export function isRecent(iso: string, minutes: number, now: Date = new Date()): boolean {
  const then = new Date(iso).getTime()
  return !Number.isNaN(then) && now.getTime() - then < minutes * 60_000
}

/** Whether this supplier's details may be changed from here. A supplier on Procure Paddy manages their own. */
export function mayEditSupplier(vendor: CompanyVendor, canEdit: boolean): boolean {
  return canEdit && vendor.kind !== 'VERIFIED' && vendor.editable !== false
}


/**
 * A quantity said the same way everywhere a purchase order shows one: "20 bags (50 kg)", "4 kg",
 * "1 piece". The form, the order page, the list and the message all use this, so one order never
 * reads "20 bags" in one place and "2 × Bag · 50 kg" in another.
 */
export function quantityWords(quantity: number, comesIn: string): string {
  const pack = looksLikePack(comesIn)
  const word = quantityUnitWord({ comesIn, pack }, quantity)
  const amount = formatQuantity(quantity)
  const size = pack ? comesIn.split(' · ').slice(1).join(' · ').trim() : ''
  return size ? `${amount} ${word} (${size})` : `${amount} ${word}`
}

/** 20, 2.5, 1,200 — no trailing zeros, thousands grouped. */
export function formatQuantity(value: number): string {
  return new Intl.NumberFormat('en-NG', { maximumFractionDigits: 2 }).format(value)
}

/** The plural word for a way of buying, for the unit chooser on a line: "bags", "kg", "cartons". */
export function unitChoiceWord(line: { comesIn: string; pack: boolean }): string {
  return quantityUnitWord(line, 2)
}

/** "Tomorrow", "Thu 12 Nov" — a needed-by day, said the short way. */
export function neededWords(isoDay: string, today: string = todayIso()): string {
  if (isoDay === today) return 'Today'
  if (isoDay === addDays(today, 1)) return 'Tomorrow'
  const [year, month, day] = isoDay.split('-').map(Number)
  if (!year || !month || !day) return isoDay
  return new Intl.DateTimeFormat('en-NG', { weekday: 'short', day: 'numeric', month: 'short' }).format(
    new Date(year, month - 1, day),
  )
}

/** An ISO day plus some days, without a timezone moving it. */
export function addDays(isoDay: string, days: number): string {
  const [year, month, day] = isoDay.split('-').map(Number)
  const date = new Date(year, month - 1, day + days)
  return date.toLocaleDateString('en-CA')
}

/**
 * Money on a purchase order: "₦45,000", and "₦45,000.50" only when there are kobo. Whole naira are
 * shown whole because a trailing ".00" on every line of an order is noise; nothing is rounded away.
 */
export function orderMoney(value: number): string {
  return Number.isInteger(value) ? formatNairaWhole(value) : formatNaira(value)
}
