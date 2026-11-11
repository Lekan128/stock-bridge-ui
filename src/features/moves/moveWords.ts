import type { AreaMove, AreaReturn, MoveRest, ReturnReason } from '@/features/moves/types'
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
 * Kitchen got less of each item", "Taken back", "Undone". Null for a move that never waited and wasn't undone.
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
      const shortOf = move.lines.filter((line) => line.got != null && line.got < line.quantity).length
      if (move.lines.length === 1) {
        return `The ${move.toAreaName} got ${formatNumber(move.lines[0].got ?? 0)} of ${formatNumber(move.lines[0].quantity)}`
      }
      // Each line says how much below; here, how many lines were short.
      return shortOf === move.lines.length
        ? `The ${move.toAreaName} got less of each item`
        : `The ${move.toAreaName} got less of ${shortOf} of ${move.lines.length} items`
    }
    case 'DONE':
      return move.waits ? `The ${move.toAreaName} got everything` : null
  }
}

/** What happened to what didn't arrive, as the confirm sheet asks it (Part 6): the area it came from first. */
export function restChoices(fromAreaName: string): { value: MoveRest; label: string }[] {
  return [
    { value: 'BACK', label: `Still in the ${fromAreaName}` },
    { value: 'DAMAGED', label: 'Damaged or spoilt' },
    { value: 'EXPIRED', label: 'Expired' },
    { value: 'LOST', label: 'Missing' },
    { value: 'OTHER', label: 'Something else' },
  ]
}

/** "still in the Store", "damaged or spoilt", "missing" - after a number, on a confirmed move. */
export function restWords(rest: MoveRest, fromAreaName: string): string {
  switch (rest) {
    case 'BACK':
      return `still in the ${fromAreaName}`
    case 'DAMAGED':
      return 'damaged or spoilt'
    case 'EXPIRED':
      return 'expired'
    case 'LOST':
      return 'missing'
    case 'OTHER':
      return "didn't arrive"
  }
}

/** A report's reasons, as the Report form offers them (Part 6). */
export const RETURN_REASONS: { value: ReturnReason; label: string; word: string }[] = [
  { value: 'SPOILT', label: 'Spoilt', word: 'spoilt' },
  { value: 'EXPIRED', label: 'Expired', word: 'expired' },
  { value: 'DAMAGED', label: 'Damaged', word: 'damaged' },
  { value: 'OTHER', label: 'Other', word: 'not used' },
]

/** Why something is given back (Part 6): not needed to start with, or what was wrong with it. */
export const GIVE_BACK_REASONS: { value: ReturnReason | 'NOT_NEEDED'; label: string }[] = [
  { value: 'NOT_NEEDED', label: 'Not needed' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'OTHER', label: 'Other' },
]

/** "1 bag given back (expired) · 2 bags reported spoilt" - what the area it arrived in did with a line. */
export function returnsSaid(returns: AreaReturn[] | undefined, say: (n: number) => string, per: number): string | null {
  if (!returns || returns.length === 0) return null
  return returns
    .map((r) =>
      r.kind === 'GIVE_BACK'
        ? `${say(r.quantity / per)} given back${r.reason ? ` (${RETURN_REASONS.find((reason) => reason.value === r.reason)?.word ?? ''})` : ''}`
        : `${say(r.quantity / per)} reported ${RETURN_REASONS.find((reason) => reason.value === r.reason)?.word ?? ''}`.trim(),
    )
    .join(' · ')
}
