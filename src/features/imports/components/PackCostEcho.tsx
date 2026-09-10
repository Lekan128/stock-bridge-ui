import { copy } from '@/features/imports/copy'
import type { UnitOption } from '@/features/products/types'
import { formatStockUnitCostEcho } from '@/features/products/unitCopy'

export interface PackCostEchoProps {
  /** What the user typed — ₦ per one PACK, which is what this column now holds (§9.2, amended). */
  pricePerPack: number | null
  /** The stock unit's short label ("kg"), for the stored figure this echoes. */
  stockUnitLabel: string
  /** This row's pack, from `reviewColumns.rowPackOption`. Null when the row declares none. */
  packOption: UnitOption | null
  className?: string
}

/**
 * `UNIT_UX_CONTRACT.md` §9.2's per-pack cost echo, under a cost cell on the review screen.
 *
 * <h2>What it is for</h2>
 * §9.2 still anchors every **stored** cost to the stock unit — ₦ per ml, not ₦ per keg — because
 * that is the only figure comparable across suppliers whose packs differ. What changed is the
 * basis it is **typed** in: the amended §9.2 reads this column as ₦ per PACK, the same unit as
 * the opening stock beside it, which is what Odoo (vendor pricelist price per Purchase UoM) and
 * NetSuite (Purchase Price per purchase unit) have always done.
 *
 * So this echo now runs the other way — it shows what will be stored, not what the pack would
 * cost. It had to: while the column was read per stock unit, a mango row of **45 baskets** and
 * **78,000** echoed "= ₦2,340,000.00 / basket". Arithmetically perfect (78,000 × 30) and entirely
 * wrong, because 78,000 was the price of one basket. That echo is what surfaced the mixed basis —
 * quantity in packs, price per stock unit, in two adjacent cells — and got §9.2 amended.
 *
 * <h2>Why the sentence is doubled</h2>
 * Same arrangement as the `"= 1,500 ml"` conversion line beside it, and for the same reason.
 * Sighted readers get the compact form because it has to fit under a narrow cell in a grid that
 * already scrolls sideways; screen-reader users get the whole sentence, because "equals eighty
 * thousand naira per bag" announced on its own, with no column header attached, is a fragment
 * nobody can place. It is text and it sits in the reading order directly under the number it
 * restates — never colour, never a `title`, which is unreachable by keyboard and touch alike.
 *
 * No live region. It changes on every keystroke by design, and a polite region firing on each one
 * would talk over the person typing. The line is context for the cell, read when the cell is,
 * exactly as the quantity conversion above it is.
 *
 * Renders nothing when there is nothing to say. {@link formatPackCostEcho} already returns null
 * for no pack, a pack that IS the stock unit, an unusable factor and a price of zero or blank —
 * so this needs no guard of its own, and a caller needs none either.
 */
export function PackCostEcho({ pricePerPack, packOption, stockUnitLabel, className = '' }: PackCostEchoProps) {
  const echo = formatStockUnitCostEcho(pricePerPack, packOption, stockUnitLabel)
  if (echo == null) return null

  return (
    <p
      className={`text-xs font-medium whitespace-nowrap text-neutral-600 tabular-nums ${className}`}
    >
      <span aria-hidden="true">{echo}</span>
      <span className="sr-only">{copy.review.packCostTitle(echo)}</span>
    </p>
  )
}
