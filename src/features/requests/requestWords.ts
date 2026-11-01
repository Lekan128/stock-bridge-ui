import type { StockRequest, StockRequestLine } from '@/features/requests/types'
import { formatNumber, formatQuantity, pluraliseUnitNoun } from '@/features/products/unitCopy'

/** "2 items". */
export function itemsWord(count: number): string {
  return `${count} ${count === 1 ? 'item' : 'items'}`
}

/** "The Kitchen asked for 2 items". */
export function askedFor(request: StockRequest): string {
  return `The ${request.toAreaName} asked for ${itemsWord(request.lines.length)}`
}

/** An amount as asked: "2 bags" when asked in a pack, else the stock unit ("3 pieces"). */
export function askedAmount(
  line: Pick<StockRequestLine, 'quantity' | 'enteredQuantity' | 'enteredUnit'>,
  stockSymbol: string,
): string {
  const packs = line.enteredQuantity
  if (packs != null && packs > 0 && line.enteredUnit) {
    return `${formatNumber(packs)} ${pluraliseUnitNoun(line.enteredUnit.toLowerCase(), packs)}`
  }
  return formatQuantity(line.quantity, stockSymbol || undefined)
}

/**
 * Where a request stands (Part 5): *Asked* · *Partly moved* · *Moved* · *Moved, some none in the store* · *None in
 * the store* · *Cancelled*.
 */
export function requestState(request: StockRequest): string {
  if (request.status === 'CANCELLED') return 'Cancelled'
  const anyMoved = request.lines.some((line) => line.moved > 0)
  const anyNone = request.lines.some((line) => line.noneInStore && line.moved < line.quantity)
  if (request.status === 'DONE') {
    if (!anyMoved) return `None in the ${request.fromAreaName}`
    return anyNone ? `Moved, some none in the ${request.fromAreaName}` : 'Moved'
  }
  return anyMoved ? 'Partly moved' : 'Asked'
}

/** One line's state, after its amount: "moved", "3 of 4 moved", "none in the Store", or nothing yet. */
export function lineState(line: StockRequestLine, fromName: string): string | null {
  if (line.moved >= line.quantity) return 'moved'
  if (line.noneInStore) return `none in the ${fromName}`
  if (line.moved > 0) return `${formatNumber(line.moved)} of ${formatNumber(line.quantity)} moved`
  return null
}
