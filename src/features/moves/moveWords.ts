import type { AreaMove } from '@/features/moves/types'
import { formatNumber, formatQuantity, pluraliseUnitNoun } from '@/features/products/unitCopy'

export type MoveLine = AreaMove['lines'][number]

/**
 * The unit a line is spoken in: the pack it was moved in ("2 bags") when every unit moved is a whole pack,
 * else the product's stock unit. `per` is how many stock units one is.
 */
export function lineUnit(line: MoveLine, stockSymbol: string): { per: number; say: (n: number) => string } {
  const packs = line.enteredQuantity
  if (packs != null && packs > 0 && line.enteredUnit && Number.isInteger(packs) && line.quantity % packs === 0) {
    const per = line.quantity / packs
    const noun = line.enteredUnit.toLowerCase()
    return { per, say: (n) => `${formatNumber(n)} ${pluraliseUnitNoun(noun, n)}` }
  }
  return { per: 1, say: (n) => formatQuantity(n, stockSymbol || undefined) }
}

/** "2 items". */
export function itemsWord(count: number): string {
  return `${count} ${count === 1 ? 'item' : 'items'}`
}

/**
 * Where a move stands, in a few words (Part 4): "Waiting for the Kitchen", "The Kitchen got everything", "The
 * Kitchen got 1 of 2 in full", "Taken back", "Undone". Null for a move that never waited and wasn't undone.
 */
export function moveState(move: AreaMove): string | null {
  switch (move.status) {
    case 'WAITING':
      return `Waiting for the ${move.toAreaName}`
    case 'CANCELLED':
      return 'Taken back'
    case 'VOIDED':
      return 'Undone'
    case 'CONFIRMED_SHORT': {
      const whole = move.lines.filter((line) => line.got === line.quantity).length
      return move.lines.length === 1
        ? `The ${move.toAreaName} got ${formatNumber(move.lines[0].got ?? 0)} of ${formatNumber(move.lines[0].quantity)}`
        : `The ${move.toAreaName} got ${whole} of ${move.lines.length} in full`
    }
    case 'DONE':
      return move.waits ? `The ${move.toAreaName} got everything` : null
  }
}
