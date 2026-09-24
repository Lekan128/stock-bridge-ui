import type { DeliveryLine, DeliveryLineInput } from '@/features/imports/types'
import { formatNaira, formatNairaWhole } from '@/utils/money'

/**
 * The "Record a delivery" screen's arithmetic and wording, kept out of the page so the page is
 * only layout and requests.
 */

/**
 * What the storekeeper has typed against one line. Kept as text, not numbers: "2." is a valid
 * moment on the way to "2.5", and parsing it on every keystroke would eat the dot.
 */
export interface DeliveryEntry {
  /**
   * The line it was typed against, carried along so the entry still counts — and can still be
   * posted — after the list has switched to another supplier that does not show it.
   */
  line: DeliveryLine
  quantity: string
  price: string
  /** The "Change" button was pressed, so the price input stays open. */
  editingPrice: boolean
}

/**
 * Typed values are keyed by product AND unit, never by position: switching from one supplier's
 * products to all of them reorders and extends the list, and a quantity must stay on the line
 * it was typed against.
 */
export function lineKey(line: Pick<DeliveryLine, 'productId' | 'unit'>): string {
  return `${line.productId}|${line.unit}`
}

/** `"1,250.5"` → 1250.5. Blank → null; anything that is not a number → NaN. */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[,\s₦]/g, '')
  if (cleaned === '') return null
  return Number(cleaned)
}

/** The quantity to send, or null when the line is not part of the delivery. */
export function validQuantity(entry: DeliveryEntry | undefined): number | null {
  const value = entry ? parseAmount(entry.quantity) : null
  return value != null && Number.isFinite(value) && value > 0 ? value : null
}

/** A typed quantity that can never be sent — "abc", "-2". Zero and blank are just "not this one". */
export function quantityIsInvalid(entry: DeliveryEntry | undefined): boolean {
  const value = entry ? parseAmount(entry.quantity) : null
  return value != null && (!Number.isFinite(value) || value < 0)
}

/** undefined = no price typed (use the last one); NaN = typed but unusable. */
export function typedPrice(entry: DeliveryEntry | undefined): number | undefined {
  const value = entry ? parseAmount(entry.price) : null
  if (value == null) return undefined
  return Number.isFinite(value) && value >= 0 ? value : Number.NaN
}

/**
 * `₦42,000` for a round amount, `₦42,500.50` otherwise. The whole-naira formatter alone would
 * round a real kobo amount away, and the two-decimal one puts `.00` on every price a market
 * trader ever quotes.
 */
export function formatPrice(value: number): string {
  return Number.isInteger(value) ? formatNairaWhole(value) : formatNaira(value)
}

/**
 * "a bag" / "an egg crate" for a pack line — the words before " · " in `comesIn` — and "per kg" /
 * "per piece" for the product's own unit, from the words after it (or the whole label when there
 * is no dot, as for "Piece").
 */
export function perUnitWords(line: Pick<DeliveryLine, 'comesIn' | 'pack'>): string {
  const [head, ...rest] = line.comesIn.split(' · ')
  if (line.pack) {
    const noun = head.trim().toLowerCase()
    return `${/^[aeiou]/.test(noun) ? 'an' : 'a'} ${noun}`
  }
  const tail = rest.join(' · ').trim()
  return `per ${tail || head.trim().toLowerCase()}`
}

/** One product's lines, groups in the order the server listed them (supplier, then product). */
export interface DeliveryProductGroup {
  productId: string
  productName: string
  sku: string
  lines: DeliveryLine[]
}

export function groupByProduct(lines: DeliveryLine[]): DeliveryProductGroup[] {
  const groups = new Map<string, DeliveryProductGroup>()
  for (const line of lines) {
    let group = groups.get(line.productId)
    if (!group) {
      group = { productId: line.productId, productName: line.productName, sku: line.sku, lines: [] }
      groups.set(line.productId, group)
    }
    group.lines.push(line)
  }
  return [...groups.values()]
}

export function matchesSearch(line: DeliveryLine, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return line.productName.toLowerCase().includes(needle) || line.sku.toLowerCase().includes(needle)
}

export interface DeliveryTally {
  /** What gets posted, in the order the quantities were first typed. */
  lines: DeliveryLineInput[]
  /** Sum of quantity × price over the lines whose price is known. */
  total: number
  /** Some counted line has neither a typed nor a last price, so `total` leaves it out. */
  partial: boolean
  /** A typed price or quantity cannot be sent. */
  invalid: boolean
}

/**
 * Everything the bottom bar and the request need, from what was typed — including lines the
 * current list is not showing.
 */
export function tally(entries: Record<string, DeliveryEntry>): DeliveryTally {
  const result: DeliveryTally = { lines: [], total: 0, partial: false, invalid: false }
  for (const entry of Object.values(entries)) {
    const { line } = entry
    if (quantityIsInvalid(entry)) result.invalid = true
    const quantity = validQuantity(entry)
    if (quantity == null) continue

    const price = typedPrice(entry)
    if (price != null && Number.isNaN(price)) result.invalid = true
    const usable = price != null && !Number.isNaN(price) ? price : undefined

    result.lines.push({ productId: line.productId, unit: line.unit, quantity, price: usable })
    const effective = usable ?? line.lastPrice
    if (effective == null) result.partial = true
    else result.total += quantity * effective
  }
  // To the kobo, so 2.5 × 1,000.1 does not show as ₦2,500.2500000001.
  result.total = Math.round(result.total * 100) / 100
  return result
}
