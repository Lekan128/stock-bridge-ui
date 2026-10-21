import type { Product, UnitOption, UnitOfMeasureOption } from '@/features/products/types'
import { parseMoneyInput } from '@/features/selling/money'
import { formatNumber, pluraliseUnitNoun, stockUnitWord, unitNoun } from '@/features/products/unitCopy'
import { productsOwnUnits, resolveUnitSymbol, stockUnitOption, unitOptionsForProduct } from '@/features/products/unitSet'

/**
 * One line of a sale being put together (`SELLING_PRICE_PLAN.md` §6.1). Kept as a draft on the
 * phone, so a closed app keeps the customer's items - hence a plain object with the product in it.
 */
export interface SaleLine {
  key: string
  product: Product
  /** The unit counted in, by its label (unique within a product's set; a code can repeat). */
  unitLabel: string
  /** Whole units of `unitLabel` - the stock-out takes a whole number. */
  quantity: number
  /** A price each the seller typed, or null to use the usual price. */
  priceTyped: string | null
  /** A total for the whole line the seller typed ("the six for 10,800"), or null. Wins over the price. */
  totalTyped: string | null
  /** Why the server refused this line when the sale was recorded - shown on it until it is changed. */
  problem?: string
}

export function unitsFor(product: Product, catalogue: UnitOfMeasureOption[]): UnitOption[] {
  return productsOwnUnits(unitOptionsForProduct(product, catalogue))
}

/**
 * The unit a new line opens in: the one its usual price was typed per ("5,000 a carton" opens as 1
 * carton at 5,000, not 1 piece at 208.33), else the stock unit.
 */
export function openingUnit(product: Product, options: UnitOption[]): UnitOption {
  return (
    options.find((option) => !option.isStockUnit && option.code === product.unitPriceEnteredUnit) ??
    stockUnitOption(options)
  )
}

export function optionOf(line: SaleLine, options: UnitOption[]): UnitOption {
  return options.find((option) => option.label === line.unitLabel) ?? stockUnitOption(options)
}

/**
 * The usual price for one of `option`: exactly as typed when it was typed per this unit, else the
 * per-stock-unit price times the unit's size, to the kobo. Null when the product has no price.
 */
export function usualPrice(product: Product, option: UnitOption): number | null {
  if (product.unitPriceEntered != null && !option.isStockUnit && product.unitPriceEnteredUnit === option.code) {
    return product.unitPriceEntered
  }
  if (product.unitPrice == null) return null
  return Math.round(product.unitPrice * option.factorToStockUnit * 100) / 100
}

const parse = parseMoneyInput

/**
 * What `quantity` of `option` comes to at the usual price, worked from the price AS TYPED: 24 pieces
 * of a "₦5,000 a carton" product are ₦5,000, not 24 × ₦208.33 = ₦4,999.92. Null with no price.
 */
export function usualAmount(product: Product, option: UnitOption, options: UnitOption[], quantity: number): number | null {
  const typedUnit =
    product.unitPriceEntered != null && product.unitPriceEnteredUnit
      ? options.find((o) => !o.isStockUnit && o.code === product.unitPriceEnteredUnit)
      : undefined
  if (typedUnit && product.unitPriceEntered != null) {
    return Math.round(((product.unitPriceEntered * quantity * option.factorToStockUnit) / typedUnit.factorToStockUnit) * 100) / 100
  }
  if (product.unitPrice == null) return null
  return Math.round(product.unitPrice * option.factorToStockUnit * quantity * 100) / 100
}

/** The price each the line is sold at: typed, derived from a typed total, or the usual one. */
export function priceEach(line: SaleLine, option: UnitOption): number | null {
  const total = parse(line.totalTyped)
  if (total != null && line.quantity > 0) return Math.round((total / line.quantity) * 100) / 100
  return line.priceTyped != null ? parse(line.priceTyped) : usualPrice(line.product, option)
}

/**
 * What the line comes to - a typed total exactly; price each × quantity when a price was typed;
 * else the usual price, worked from the price as typed so a carton's pieces add up to the carton.
 * Null with no price.
 */
export function lineAmount(line: SaleLine, option: UnitOption, options?: UnitOption[]): number | null {
  const total = parse(line.totalTyped)
  if (total != null) return total
  if (line.priceTyped == null && options) return usualAmount(line.product, option, options, line.quantity)
  const each = priceEach(line, option)
  return each == null ? null : Math.round(each * line.quantity * 100) / 100
}

/** Whether the line is sold at less than its usual price - said quietly, never as a warning. */
export function belowUsual(line: SaleLine, option: UnitOption): number | null {
  const usual = usualPrice(line.product, option)
  const each = priceEach(line, option)
  if (usual == null || each == null || each >= usual - 0.005) return null
  return usual
}

/** "2 bags", "1 carton", "3 kg" - the line's quantity in the unit it was sold in. */
export function quantityText(line: SaleLine, catalogue: UnitOfMeasureOption[]): string {
  const option = optionOf(line, unitsFor(line.product, catalogue))
  const noun = option.isStockUnit ? stockUnitWord(resolveUnitSymbol(line.product.unitOfMeasure, catalogue), line.quantity) : pluraliseUnitNoun(unitNoun(option), line.quantity)
  return `${formatNumber(line.quantity)} ${noun}`
}

