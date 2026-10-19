import type { Product, UnitOption } from '@/features/products/types'
import { unitNoun } from '@/features/products/unitCopy'
import { formatMoney } from '@/features/selling/money'

/**
 * A product's selling price the way it was set: "₦5,000 / carton" when it was typed per carton
 * (API V47), else per stock unit - "₦250 / kg". Null when it has none.
 *
 * @param packOption the product's own pack, from `buildPackOption` - the only unit other than the
 *     stock unit a price can be typed per.
 */
export function sellingPriceText(
  product: Pick<Product, 'unitPrice' | 'unitPriceEntered' | 'unitPriceEnteredUnit'>,
  stockUnitText: string,
  packOption: UnitOption | null,
): string | null {
  if (product.unitPrice == null) return null
  if (product.unitPriceEntered != null && packOption != null && packOption.code === product.unitPriceEnteredUnit) {
    return `${formatMoney(product.unitPriceEntered)} / ${unitNoun(packOption)}`
  }
  return `${formatMoney(product.unitPrice)} / ${stockUnitText}`
}

/** The price per stock unit, said only when the price above was typed per pack: "₦208.33 / kg". */
export function perStockUnitEcho(
  product: Pick<Product, 'unitPrice' | 'unitPriceEntered' | 'unitPriceEnteredUnit'>,
  stockUnitText: string,
  packOption: UnitOption | null,
): string | null {
  if (product.unitPrice == null || product.unitPriceEntered == null || packOption?.code !== product.unitPriceEnteredUnit) return null
  return `${formatMoney(product.unitPrice)} / ${stockUnitText}`
}

/**
 * A list row's selling price: "₦5,000 / carton" as typed, else "₦250 / kg". Null without one.
 * Takes the unit-of-measure catalogue rather than a pack option, since a list builds no options.
 */
export function listPriceText(
  product: Pick<Product, 'unitPrice' | 'unitPriceEntered' | 'unitPriceEnteredUnit' | 'unitOfMeasure'>,
  unitOfMeasureOptions: { code: string; label: string; symbol?: string | null }[],
): string | null {
  if (product.unitPrice == null) return null
  if (product.unitPriceEntered != null && product.unitPriceEnteredUnit) {
    const pack = unitOfMeasureOptions.find((option) => option.code === product.unitPriceEnteredUnit)?.label
    return `${formatMoney(product.unitPriceEntered)} / ${(pack ?? product.unitPriceEnteredUnit).toLowerCase()}`
  }
  const stock = unitOfMeasureOptions.find((option) => option.code === product.unitOfMeasure)
  const unit = stock?.symbol || stock?.label?.toLowerCase()
  return unit ? `${formatMoney(product.unitPrice)} / ${unit}` : formatMoney(product.unitPrice)
}
