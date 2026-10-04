import type { Product, UnitOfMeasureOption } from '@/features/products/types'
import { formatQuantityEcho, unitNoun } from '@/features/products/unitCopy'
import { buildPackOption, fromBaseQuantity, resolveUnitSymbol } from '@/features/products/unitSet'

/**
 * "= 20 bags" under an on-hand figure of 1,000 kg — the same treatment
 * {@link StockBreakdownPanel} gives the detail page's headline, and the same rule. Shared by the
 * desktop table and the phone card, so the two can never state the same row differently.
 *
 * Storage stays in the stock unit: a pack size that changes must never silently rewrite what is
 * on the shelf, which is why Odoo and NetSuite both hold stock in the base unit and let
 * packagings ride on top. But nobody counts 1,600 kg of rice, they count 32 bags, and a list a
 * user has to do arithmetic against is a list they stop reading.
 *
 * <h3>Only whole packs, and that is not a rounding convenience</h3>
 * 19.6 bags is not a sentence anyone wants, and a part-pack is exactly the case where the stock
 * unit is the honest answer — so a figure that does not divide evenly is left as the stock unit
 * alone. This also keeps the second line rare rather than universal, which is what earns it the
 * row height: on a catalog of loose goods the column looks exactly as it did.
 *
 * Built from the product's own pack rather than from a full unit set (`unitOptionsForProduct`)
 * because that is all this line can ever show and the set's step-4 base units (g, t) would add a
 * scan of the whole unit list per row for options this cell never renders.
 */
export function packEquivalent(product: Product, unitOfMeasureOptions: UnitOfMeasureOption[]): string | null {
  if (product.quantityOnHand <= 0) return null
  const option = buildPackOption(
    product,
    resolveUnitSymbol(product.unitOfMeasure, unitOfMeasureOptions),
    unitOfMeasureOptions,
  )
  if (option == null) return null
  const inPacks = fromBaseQuantity(product.quantityOnHand, option)
  if (!Number.isInteger(inPacks) || inPacks <= 0) return null
  return formatQuantityEcho(inPacks, unitNoun(option))
}
