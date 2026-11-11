import type { PickerLine } from '@/features/expected/types'

/**
 * One product on a purchase order being made: one line per product, whatever way it is bought, with
 * the unit chosen beside the quantity ("20 bags ▾"). The picker returns one row per way of buying;
 * they are folded together here so the form never shows "Rice · Bag" and "Rice · Loose" as two lines.
 */
export interface OrderItem {
  /** The product id; an old order that asked for one product two ways gives the second `productId:unit`. */
  key: string
  productId: string
  productName: string
  sku: string
  /** Every way it is bought, each with its own stock figures in its own unit. */
  options: PickerLine[]
  /** The chosen option's unit key. */
  unit: string
  /** As typed. Blank until somebody says how many. */
  quantity: string
  /**
   * Price of ONE of the chosen unit, as typed (plan section 11.4). Starts at the last price paid to
   * this supplier. Absent on a draft kept before prices; read it through `priceText`.
   */
  price?: string
}

/** Picker rows grouped by product, in the order the server sent them. */
export function groupByProduct(lines: PickerLine[]): PickerLine[][] {
  const groups = new Map<string, PickerLine[]>()
  for (const line of lines) {
    const group = groups.get(line.productId)
    if (group) group.push(line)
    else groups.set(line.productId, [line])
  }
  return [...groups.values()]
}

/** The way it is usually bought from this supplier, else the first. */
export function usualOption(options: PickerLine[]): PickerLine {
  return options.find((option) => option.usual) ?? options[0]
}

/** A new line for a product: its usual unit, and last time's quantity when there was one. */
export function itemFrom(options: PickerLine[], quantity?: string): OrderItem {
  const usual = usualOption(options)
  return {
    key: usual.productId,
    productId: usual.productId,
    productName: usual.productName,
    sku: usual.sku,
    options,
    unit: usual.unit,
    quantity: quantity ?? (usual.lastOrdered != null ? String(usual.lastOrdered) : ''),
    price: usual.lastPrice != null ? moneyText(usual.lastPrice) : '',
  }
}

export function priceText(item: OrderItem): string {
  return item.price ?? ''
}

/** A typed amount of money as a number of 0 or more, or null (blank or not a number). "45,000" is 45000. */
export function moneyOf(typed: string): number | null {
  const text = typed.trim().replace(/[,₦\s]/g, '')
  if (text === '') return null
  const value = Number(text)
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : null
}

export function priceOf(item: OrderItem): number | null {
  return moneyOf(priceText(item))
}

/** Something typed in the price box that isn't a price. */
export function priceInvalid(item: OrderItem): boolean {
  return priceText(item).trim() !== '' && priceOf(item) == null
}

/** Quantity times price, to the kobo; null until both are there. */
export function amountOf(item: OrderItem): number | null {
  const quantity = quantityOf(item)
  const price = priceOf(item)
  return quantity == null || price == null ? null : Math.round(quantity * price * 100) / 100
}

/**
 * The price when the unit changes: the new unit's own last price when the box still held the old
 * one's (nobody typed), else what was typed, worked into the new unit — ₦45,000 a 50 kg bag is ₦900 a kg.
 */
export function priceForUnit(item: OrderItem, nextUnit: string): string {
  const from = chosenOption(item)
  const to = item.options.find((option) => option.unit === nextUnit) ?? from
  const typed = priceOf(item)
  const untouched = typed == null || (from.lastPrice != null && typed === from.lastPrice)
  if (untouched) return to.lastPrice != null ? moneyText(to.lastPrice) : typed == null ? '' : moneyText(convert(typed, from, to))
  return moneyText(convert(typed, from, to))
}

/** 45000 as the box shows it once typed: "45,000". */
export function moneyText(value: number): string {
  return new Intl.NumberFormat('en-NG', { maximumFractionDigits: 2 }).format(value)
}

function convert(price: number, from: PickerLine, to: PickerLine): number {
  if (!(from.perUnit > 0) || !(to.perUnit > 0)) return price
  return Math.round((price / from.perUnit) * to.perUnit * 100) / 100
}

export function chosenOption(item: OrderItem): PickerLine {
  return item.options.find((option) => option.unit === item.unit) ?? item.options[0]
}

/** The typed quantity as a number above zero, or null (blank, zero, or not a number). */
export function quantityOf(item: OrderItem): number | null {
  const text = item.quantity.trim().replace(/,/g, '')
  if (text === '') return null
  const value = Number(text)
  return Number.isFinite(value) && value > 0 ? value : null
}

/** Something typed that isn't a quantity: shown as a problem on the line, and the order waits. */
export function quantityInvalid(item: OrderItem): boolean {
  return item.quantity.trim() !== '' && quantityOf(item) == null
}

/** One more or one less, from the − / + buttons. Never below 1 from a tap. */
export function stepQuantity(item: OrderItem, step: 1 | -1): string {
  const current = quantityOf(item) ?? 0
  const next = Math.max(1, Math.floor(current) + step)
  return String(next)
}
