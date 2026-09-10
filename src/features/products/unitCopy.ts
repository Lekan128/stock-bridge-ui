import type { UnitOption } from '@/features/products/types'
import { formatNaira } from '@/utils/money'

/**
 * The one place the words for stock unit, pack and entry unit are written down.
 *
 * <h2>Why this file exists</h2>
 * `UNIT_UX_REMEDIATION_PLAN.md` §2 counted the damage: three domain concepts (stock unit, pack,
 * entry unit) exposed on six surfaces under FOUR different vocabularies. The product form said
 * "Measured in / Packaged as / Pack size", the stock-in modal said "(base unit) / Delivered as /
 * Pack size / Unit", the import grid said "Counted in / Units per pack", and the vendors tab said
 * nothing at all. A user imported a "Supplier" and landed on a "Vendors" tab. None of that was a
 * bug in any one file — it was the absence of a shared file, so every author picked a reasonable
 * word and no two picked the same one.
 *
 * `UNIT_UX_CONTRACT.md` §1 locks the vocabulary and §7.5 makes "one name per concept" an
 * acceptance criterion rather than a style preference. This module is the frontend half of the
 * enforcement (`imports/ImportCopy.java` is the backend half): **a user-facing string for these
 * concepts that is not in this file does not ship.** If you find yourself typing `per kg` or
 * `Bag of ` into a component, the function you want is below — and if it genuinely isn't, add it
 * here rather than inlining it, because the inline version is how we got four vocabularies.
 *
 * <h2>Copy, not math — with one recorded exception</h2>
 * Building a product's unit set, converting quantities and dividing prices by a conversion factor
 * live in `unitSet.ts`; this file turns already-resolved numbers and labels into sentences. The
 * split is deliberate — `unitSet` is the part with a contract-defined rounding rule and needs to
 * be reasoned about numerically; this part needs to be read aloud.
 *
 * The exception is {@link formatPackCostEcho}, added for `UNIT_UX_CONTRACT.md` §9.2, which
 * multiplies a per-stock-unit price by a pack's own factor. It is documented at length there and
 * the reason is the seam, not convenience: splitting that multiply from the sentence it produces
 * is how a number and its unit come apart, which is exactly the failure §9.2 exists to prevent.
 * It cannot delegate to `unitSet.fromBasePrice` either — `unitSet` imports this file, and the
 * import cycle would cost more than one line of arithmetic. Do not take it as licence for more:
 * anything with a contract-defined rounding scale still belongs in `unitSet`.
 *
 * <h2>Prior art for the phrasing</h2>
 * Odoo 18 renders every quantity field with its UoM glued to the input and prints vendor
 * pricelist prices as "₦x / <Purchase UoM>"; Zoho Inventory's item detail states the unit group's
 * base unit next to every figure. The shared idea, and `UNIT_UX_CONTRACT.md` §7.2's rule, is that
 * **the unit is attached to the number, never inferred from a neighbouring field** — which is why
 * every formatter below takes its unit as a required argument rather than an optional one.
 */

/**
 * The locked user-facing names from `UNIT_UX_CONTRACT.md` §1, verbatim.
 *
 * Imported as constants rather than retyped so that a rename is a one-line change here and a
 * `grep` for the banned spelling ("Measured in", "Packaged as", "Vendor", "Their SKU", "Qty on
 * hand") stays a reliable lint over the whole feature.
 */
export const UNIT_COPY = {
  /** `Product.unitOfMeasure`. Never "Measured in", "base unit", "unit of measure", "UoM". */
  STOCK_UNIT: 'Stock unit',
  /** `packagingUnit` + `packagingSize` as ONE idea. Never "Packaged as" or "Delivered as". */
  PACK: 'Pack',
  /** `packagingSize` alone, when a number must be typed. Never "Pack size". */
  UNITS_PER_PACK: 'Units per pack',
  /** The wire's `unit` — which unit the number a human just typed is expressed in. */
  COUNTED_IN: 'Counted in',
  /** `CompanyVendor`, the buyer's own directory. Never "Vendor" in user-facing text. */
  SUPPLIER: 'Supplier',
  SUPPLIERS: 'Suppliers',
  /** A marketplace seller (`marketplaceListed`, `VERIFIED` kind) — a different thing entirely. */
  SELLER: 'Seller',
  /** `ProductVendor.vendorSku`. Never "Their SKU" or "vendor SKU". */
  SUPPLIER_CODE: "Supplier's code",
  /** `ProductVendor.quantityOnHandFromVendor`. Never "Qty on hand". */
  ON_HAND_FROM_THEM: 'On hand from them',
  /** `ProductVendor.lastCostPrice` — always rendered through {@link formatPricePer}. */
  LAST_COST: 'Last cost',
  /**
   * `UNIT_UX_CONTRACT.md` §9.4 — the catalog row's opening quantity, on the sheet header, the
   * field key and the label alike.
   *
   * The spelling did not change; the MEANING did (§9.1). It counts **packs** whenever the row
   * declares one and stock units when it does not, so anywhere this label appears the unit has to
   * appear with it — see {@link fieldLabelInUnit}. A bare "Opening stock" is what let a user
   * type twelve, mean twelve 40 kg bags, and get 12 kg.
   */
  OPENING_STOCK: 'Opening stock',
  /**
   * `UNIT_UX_CONTRACT.md` §9.4 — was "Low stock threshold" (`low_stock_threshold`), which named
   * the column rather than the question. It follows §9.1's pack rule for the same reason opening
   * stock does: two quantity columns on one row that count different things is the defect the
   * amendment exists to remove.
   */
  LOW_STOCK_ALERT_AT: 'Tell me when stock falls to',
  PREFERRED: 'Preferred',
  ON_HAND: 'On hand',
  /**
   * What a quantity is counted in when the product has no stock unit set at all — the pre-V17
   * product that never got one (`UNIT_UX_CONTRACT.md` §2.1's single-entry set). Deliberately a
   * word, not a blank: "1,000" alone is the defect this whole module exists to remove, and
   * "1,000 units" is at least honest about being unitless.
   */
  NO_UNIT_LABEL: 'units',
} as const

/**
 * Quantities are grouped but never forced to a fixed number of decimals — stock is usually whole
 * ("1,000 kg") and occasionally not ("2.5 kg"), and padding the common case to "1,000.000 kg"
 * would make a table of round numbers unreadable. Three decimals is the widest any column in the
 * schema carries (`numeric(14,3)`), so nothing is silently truncated.
 *
 * `en-NG` is pinned for the same reason `utils/money.ts` pins it: the `1,234,567.89` grouping is
 * part of the product's identity and a browser set to de-DE must not render `1.234.567,89`.
 */
const quantityFormatter = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 3 })

/** `1000` → `"1,000"`, `2.5` → `"2.5"`. Null/undefined/NaN → `"0"`, never `"NaN"`. */
export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '0'
  return quantityFormatter.format(value)
}

/**
 * `"Kilogram (kg)"` → `"kg"`; `"Piece"` → `"Piece"`; unset → `"units"`.
 *
 * `UNIT_UX_CONTRACT.md` §2.1 step 1: a unit set's stock-unit entry is labelled with the SHORT
 * symbol from the parenthetical of `UnitOfMeasure.label()`, falling back to the full label when
 * there is no parenthetical. The reason is density, not taste — this string is repeated after
 * every number on the page ("1,000 kg", "₦900 / kg", "50 kg per bag"), and "1,000 Kilogram (kg)"
 * three times in one card is unreadable.
 *
 * Takes the LABEL, not the code: `"KG"` is our vocabulary, not the reader's — the same rule
 * `ImportCopy.unitLabel()` states on the backend. Callers resolve the code to a label through
 * `useUnitOfMeasureOptions` first (or `unitSet.resolveUnitLabel`).
 */
export function stockUnitSymbol(unitOfMeasureLabel: string | null | undefined): string {
  if (unitOfMeasureLabel == null) return UNIT_COPY.NO_UNIT_LABEL
  const trimmed = unitOfMeasureLabel.trim()
  if (trimmed.length === 0) return UNIT_COPY.NO_UNIT_LABEL
  const parenthetical = /\(([^()]+)\)\s*$/.exec(trimmed)
  return parenthetical ? parenthetical[1].trim() : trimmed
}

/**
 * The Pack phrase — `UNIT_UX_CONTRACT.md` §1's single rendering of `packagingUnit` +
 * `packagingSize`: `"Bag of 50 kg"`, built as `"{packagingLabel} of {packagingSize} {stockUnitSymbol}"`.
 *
 * One phrase, never two fields side by side, because "Bag" and "50" shown separately are the
 * exact ambiguity the plan's §1 root cause describes — a reader has to guess whether 50 is bags,
 * kilograms, or something per something. Returns `null` when there is no pack to describe, so
 * callers can render nothing rather than "of  " with a hole in it.
 *
 * @param packagingLabel a PACKAGING-role label, e.g. `"Bag"` — resolved from the code first.
 * @param packagingSize how many stock units are in one pack.
 * @param stockUnitSymbolText the output of {@link stockUnitSymbol}, e.g. `"kg"`.
 */
export function packPhrase(
  packagingLabel: string | null | undefined,
  packagingSize: number | null | undefined,
  stockUnitSymbolText: string,
): string | null {
  if (!packagingLabel) return null
  if (packagingSize == null || Number.isNaN(packagingSize) || packagingSize <= 0) return null
  return `${packagingLabel.trim()} of ${formatNumber(packagingSize)} ${stockUnitSymbolText}`
}

/**
 * The countable noun for a unit option — `"bag"` for a pack, `"kg"` for a stock unit.
 *
 * A `UnitOption.label` is built for a picker, where "Bag of 50 kg" is exactly right. It is wrong
 * inline in a sentence: "20 Bag of 50 kgs" and "₦45,000 / Bag of 50 kg" both read as mistakes.
 * So sentences use the noun and pickers use the label, and this is the bridge between them.
 *
 * <h3>Why this parses the label instead of reading a field</h3>
 * `UNIT_UX_CONTRACT.md` §2 freezes `UnitOption`'s wire shape at five fields, and the set is
 * server-composed (§2.3) — there is no noun on the wire to read, and adding one would be a
 * contract change. Parsing back out of `"{noun} of {n} {symbol}"` is safe precisely because that
 * shape is contract-locked and {@link packPhrase} is the only thing that builds it.
 *
 * The result is lower-cased when it is an English word (`"Bag"` → `"bag"`) so it reads correctly
 * mid-sentence, and left alone when it is a symbol (`"kg"`, `"L"`, `"mL"`) where case is meaning.
 */
export function unitNoun(option: UnitOption): string {
  const source = option.isStockUnit ? option.label : (option.label.split(' of ')[0] ?? option.label)
  const noun = source.trim()
  if (noun.length === 0) return UNIT_COPY.NO_UNIT_LABEL
  // A capital followed by a lower-case letter marks an English word ("Bag", "Piece", "Carton");
  // a symbol is either all-caps or already lower-case ("kg", "L", "mL"), and lower-casing those
  // would turn litres into something else.
  return /^[A-Z][a-z]/.test(noun) ? noun.charAt(0).toLowerCase() + noun.slice(1) : noun
}

/**
 * `("bag", 20)` → `"bags"`; `("bag", 1)` → `"bag"`; `("kg", 20)` → `"kg"`.
 *
 * Symbols are never pluralised — "20 kgs" is wrong in a way readers notice. The heuristic is
 * "three or more letters, no digits, not already plural", which is safe because these strings do
 * not come from free text: they come from the fixed ~28-row list at
 * `GET /api/products/units-of-measure`, where every symbol is one or two characters (`g`, `kg`,
 * `mg`, `t`, `mL`, `L`, `mm`, `cm`, `m`) and every word is a packaging noun or `Piece`.
 */
export function pluraliseUnitNoun(noun: string, quantity: number): string {
  if (quantity === 1) return noun
  if (!/^[A-Za-z]{3,}$/.test(noun)) return noun
  if (noun.endsWith('s')) return noun
  return `${noun}s`
}

/**
 * A quantity that carries its unit — `UNIT_UX_CONTRACT.md` §7.2's non-negotiable, and the rule
 * `utils/units.ts` stated for the marketplace surfaces and the inventory surfaces then ignored
 * (plan §3's P2: the product page's 3xl headline stock figure had no unit on it at all).
 *
 * `(1000, "kg")` → `"1,000 kg"`; `(20, "bag")` → `"20 bags"`; `(1, "bag")` → `"1 bag"`.
 *
 * Takes a NOUN or symbol, not a pack phrase — pass `unitNoun(option)`, or use
 * {@link formatQuantityInUnit} which does that for you.
 */
export function formatQuantity(quantity: number, unitLabel: string | null | undefined): string {
  const noun = unitLabel?.trim() || UNIT_COPY.NO_UNIT_LABEL
  return `${formatNumber(quantity)} ${pluraliseUnitNoun(noun, quantity)}`
}

/**
 * @deprecated Use {@link formatQuantity}, which this is now an alias of. Kept only so the two
 * stock modals (M5's files) keep compiling through `stockUnitMath.ts`'s shim while they are
 * rewritten; delete the alias once nothing imports `formatCount`.
 */
export function formatCount(quantity: number, unitLabel: string): string {
  return formatQuantity(quantity, unitLabel)
}

/** `(20, {label: "Bag of 50 kg", ...})` → `"20 bags"`. The sentence form of a unit option. */
export function formatQuantityInUnit(quantity: number, option: UnitOption): string {
  return formatQuantity(quantity, unitNoun(option))
}

/**
 * Both numbers, on one line: `"20 bags (1,000 kg)"`.
 *
 * `UNIT_UX_CONTRACT.md` §7.3 — *what the user typed and what the ledger records appear together
 * on every confirm surface*. Plan §3's P0-4 and P1-2 are both the absence of this string: a
 * confirm screen that said "5 cartons" while the ledger took 60 kg, and a preview that dropped
 * the conversion line on exactly the path where the conversion was happening.
 *
 * Collapses to the single figure when the entry unit IS the stock unit — "1,000 kg (1,000 kg)"
 * is noise, and the parenthetical must mean "and here is the other number", not "and here it is
 * again".
 */
export function formatEnteredAndBase(
  enteredQuantity: number,
  option: UnitOption,
  baseQuantity: number,
  stockUnitLabel: string,
): string {
  if (option.isStockUnit) {
    // Third branch, added when §9.1 made decimals legal. §3.1 rounds a stored quantity at scale 0,
    // so "0.5 kg" is recorded as 1 kg — and since §9.3 puts stock-out's default ON the stock unit,
    // that is now the DEFAULT path rather than an exotic one. Collapsing to a single figure here
    // (which is what this branch used to do unconditionally) would state the typed number and
    // silently record a different one, which is exactly what §7.3 forbids. So when rounding moved
    // the number, both figures are shown; when it did not, one still is, because "1,000 kg
    // (1,000 kg)" is noise rather than a second fact.
    //
    // Module N2 found this and, correctly, could not fix it here — this file was another module's
    // and closed — so it lived duplicated across both stock modals until consolidation. A
    // formatting rule kept in two places is the drift this whole remediation exists to remove.
    if (enteredQuantity !== baseQuantity) {
      return `${formatQuantity(enteredQuantity, stockUnitLabel)} (${formatQuantity(baseQuantity, stockUnitLabel)} recorded)`
    }
    return formatQuantity(baseQuantity, stockUnitLabel)
  }
  return `${formatQuantityInUnit(enteredQuantity, option)} (${formatQuantity(baseQuantity, stockUnitLabel)})`
}

/**
 * A price that says what it is per — `"₦45,000.00 / bag"`, `"₦900.00 / kg"`.
 *
 * `UNIT_UX_CONTRACT.md` §7.2: *no price field is labelled without naming what it is per*. Plan
 * §3's P0-1 and P0-2 are both what happens when it is not: a number labelled only "Unit price"
 * was entered per bag, stored per kilogram, and then compared against a third number of unknown
 * basis. Odoo's vendor pricelist never has this problem because the unit is printed as part of
 * the price, which is what the ` / ` in this string is doing.
 *
 * Money goes through `utils/money.ts` — there is exactly one place in this app that decides what
 * naira looks like, and a null amount renders as an em dash there rather than "₦NaN / kg" here.
 */
export function formatPricePer(price: number | null | undefined, unitLabel: string): string {
  if (price == null || Number.isNaN(price)) return formatNaira(price)
  return `${formatNaira(price)} / ${unitLabel.trim() || UNIT_COPY.NO_UNIT_LABEL}`
}

/** {@link formatPricePer} against a unit option's noun — `"₦45,000.00 / bag"`. */
export function formatPricePerOption(price: number | null | undefined, option: UnitOption): string {
  return formatPricePer(price, unitNoun(option))
}

/**
 * The mirror of {@link formatPackCostEcho}: a price typed **per pack**, echoed as the
 * per-stock-unit figure that actually gets stored — `(78000, basketOf30kg, "kg")` → `"= ₦2,600.00
 * / kg stored"`.
 *
 * <h2>Why both directions exist</h2>
 * Which echo helps depends entirely on which basis the number was typed in, and the two are never
 * both useful at once:
 *
 * - A price **already per stock unit** (a supplier line's `lastCostPrice`, a stored price break)
 *   is echoed UP by {@link formatPackCostEcho}, because "₦80,000 a bag" is the figure on the
 *   invoice and the one a human can sanity-check.
 * - A price **typed per pack** — which, since `UNIT_UX_CONTRACT.md` §9.2 was amended, is every
 *   cost entered on a catalog row or the product form — is echoed DOWN by this function, because
 *   the typed number needs no restating and the stored one is the thing that is not on screen.
 *
 * Using the wrong one produces a number that is arithmetically perfect and completely wrong. That
 * is not hypothetical: a mango row reading **45 baskets** and **78,000** echoed
 * "= ₦2,340,000.00 / basket", which is exactly 78,000 × 30 and exactly not what the user meant —
 * they had typed the price of one basket. That echo is what surfaced the mixed basis and got §9.2
 * amended.
 *
 * Returns null in the same cases {@link formatPackCostEcho} does, so no caller needs a guard.
 */
export function formatStockUnitCostEcho(
  pricePerPack: number | null | undefined,
  packOption: UnitOption | null | undefined,
  stockUnitLabel: string,
): string | null {
  if (packOption == null || packOption.isStockUnit) return null
  const factor = packOption.factorToStockUnit
  if (!Number.isFinite(factor) || factor <= 0) return null
  if (pricePerPack == null || !Number.isFinite(pricePerPack) || pricePerPack <= 0) return null
  return `${formatPricePer(pricePerPack / factor, stockUnitLabel)} stored`
}

/**
 * The per-pack **cost echo** — `"= ₦80,000.00 / bag"` from a price of ₦1,000 per kg against a
 * 80 kg bag. `UNIT_UX_CONTRACT.md` §9.2, and the price the user is holding an invoice for.
 *
 * <h2>Why this exists at all</h2>
 * §9.2 anchors every stored cost to the **stock unit** — ₦ per kg, not ₦ per bag — and records
 * that as a deliberate divergence from Odoo (whose vendor pricelist price is per Purchase UoM)
 * and NetSuite (whose Purchase Price is per purchase unit), both of which convert for you. The
 * stock unit was chosen because it is the only figure comparable across suppliers whose packs
 * differ, and comparability is the job that column does.
 *
 * The contract then names the price of that choice in the same breath: an invoice reading
 * "₦80,000 a bag" has to be divided by 80 before it is typed. This function is how that is paid
 * down. **Wherever a cost is entered or displayed beside a product that has a pack, the per-pack
 * equivalent is echoed** — so nobody divides in their head to check what they typed, and a
 * misplaced factor of eighty is visible in the same glance as the number that caused it.
 *
 * <h2>Why the multiplication is here, in the copy module</h2>
 * This file's own header says it does no arithmetic — building the set and converting prices
 * live in `unitSet.ts`. This is the one documented exception, and the reason is the seam rather
 * than convenience: making callers pair `fromBasePrice(price, option)` with a separate formatter
 * is exactly the split that let a price and its unit drift apart (plan §3's P0-1 and P0-2 are
 * both a number that reached a formatter having lost track of what it was per). One call, one
 * sentence, one basis. It cannot import `unitSet.fromBasePrice` to do it — `unitSet` imports
 * this file, and the cycle would be worse than the duplicated multiply.
 *
 * Rounding is display rounding only (`formatNaira`'s two decimals). Nothing computed here is
 * ever sent: the value on the wire stays the per-stock-unit figure the user typed, at §3.2's
 * scale 6.
 *
 * @param pricePerStockUnit the stored basis — ₦ per one stock unit, per §3.2.
 * @param packOption the pack to restate it in. Usually `defaultUnitOption(options)`.
 * @returns the echo, or `null` when there is nothing to echo: no pack, the pack IS the stock
 *   unit (`"= ₦1,000.00 / kg"` under a field already reading ₦1,000/kg is noise, not a check),
 *   an unusable factor, or no price. Callers render nothing on `null` rather than a hole.
 *
 *   "No price" deliberately includes zero and blank. `Number('')` is `0`, so a live form field
 *   that has not been typed into yet arrives here as zero — and `"= ₦0.00 / bag"` sitting under
 *   an empty cost box is a statement about a price nobody has entered. Every caller would
 *   otherwise write the same `> 0 &&` guard, and the one that forgot would be the one on screen.
 */
export function formatPackCostEcho(
  pricePerStockUnit: number | null | undefined,
  packOption: UnitOption | null | undefined,
): string | null {
  if (packOption == null || packOption.isStockUnit) return null
  if (pricePerStockUnit == null || !Number.isFinite(pricePerStockUnit) || pricePerStockUnit <= 0) return null
  const factor = packOption.factorToStockUnit
  if (!Number.isFinite(factor) || factor <= 0) return null
  return formatPriceEcho(pricePerStockUnit * factor, unitNoun(packOption))
}

/**
 * The click/tap-revealed breakdown behind the quantity echo — `(45, basketOf30kg, "kg", "= 1,350
 * kg")` → `"45 baskets × 30 kg per basket = 1,350 kg"`.
 *
 * <h2>Why this exists</h2>
 * A mango row reading **45** beside **"= 1,350 kg"** is only checkable by someone who already
 * knows a basket holds 30 kg — and the row's own pack cells that state 30 are usually off screen
 * (`reviewColumns.visibleFields` hides them unless flagged). This spells the multiplication out
 * for whoever asks, behind a click/tap/keyboard-focus toggle rather than hover: hover must never
 * be the only way to reach content that matters, since touch has no hover at all and a hover
 * popover inside a horizontally-scrolling grid tends to cover the very cell it explains. See
 * `CalculationDisclosure`, the toggle this feeds.
 *
 * <h2>No new arithmetic</h2>
 * This file's header reserves multiplication for one documented exception ({@link
 * formatPackCostEcho}). This is not a second one — `baseQuantityText` is taken verbatim and only
 * has its leading `=` stripped, exactly as `copy.review.baseQuantityTitle` already does, so the
 * total shown is still entirely the server's own number.
 *
 * Returns null in the same cases the quantity echo itself has nothing to say: no pack, the pack
 * IS the stock unit, an unusable factor, no quantity, or no base text to append.
 */
export function quantityCalculationSentence(
  enteredQuantity: number | null | undefined,
  packOption: UnitOption | null | undefined,
  stockUnitLabel: string,
  baseQuantityText: string | null | undefined,
): string | null {
  if (packOption == null || packOption.isStockUnit) return null
  if (enteredQuantity == null || !Number.isFinite(enteredQuantity) || enteredQuantity <= 0) return null
  if (baseQuantityText == null || baseQuantityText === '') return null
  const factor = packOption.factorToStockUnit
  if (!Number.isFinite(factor) || factor <= 0) return null
  return `${formatQuantityInUnit(enteredQuantity, packOption)} × ${formatNumber(factor)} ${stockUnitLabel} per ${unitNoun(packOption)} = ${baseQuantityText.replace(/^=\s*/, '')}`
}

/**
 * The click/tap-revealed breakdown behind {@link formatStockUnitCostEcho} — `(78000,
 * basketOf30kg, "kg")` → `"₦78,000.00 ÷ 30 = ₦2,600.00 / kg stored"`.
 *
 * Same reasoning as {@link quantityCalculationSentence}, for the other half of §9.2's pair: the
 * division that turns an invoice's "₦78,000 a basket" into the stored "₦2,600.00 / kg" is not
 * obvious to someone who cannot see the row's own pack cells. Delegates to {@link
 * formatStockUnitCostEcho} for the total rather than dividing a second time, so the two can never
 * disagree.
 */
export function costCalculationSentence(
  pricePerPack: number | null | undefined,
  packOption: UnitOption | null | undefined,
  stockUnitLabel: string,
): string | null {
  if (packOption == null || packOption.isStockUnit) return null
  if (pricePerPack == null || !Number.isFinite(pricePerPack) || pricePerPack <= 0) return null
  const factor = packOption.factorToStockUnit
  if (!Number.isFinite(factor) || factor <= 0) return null
  const echo = formatStockUnitCostEcho(pricePerPack, packOption, stockUnitLabel)
  if (echo == null) return null
  return `${formatNaira(pricePerPack)} ÷ ${formatNumber(factor)} = ${echo}`
}

/**
 * The price twin of {@link formatQuantityEcho} — `"= ₦900.00 / kg"`.
 *
 * Every restatement of a price in another unit opens with the same two characters, and this is
 * the only place they are typed. {@link formatPackCostEcho} builds §9.2's per-pack echo on top of
 * it; the price-tier form uses it directly for the opposite direction (a per-pack price divided
 * into what the ledger will store, §3.2). Same prefix either way, because to a reader they are
 * the same gesture: *here is that number again, in the other unit.*
 */
export function formatPriceEcho(price: number | null | undefined, unitLabel: string): string {
  return `= ${formatPricePer(price, unitLabel)}`
}

/**
 * The quantity twin of {@link formatPackCostEcho} — `"= 1,600 kg"`, `"= 20 bags"`.
 *
 * Every surface that shows a figure in one unit and its equivalent in another was building this
 * two-character prefix by hand (`= {formatQuantity(...)}` appeared in the stock breakdown panel,
 * the price-tier form and the product form). One helper, so the `=` never becomes a `≈` on one
 * screen and a `→` on another, and so §7.3's "what the user typed and what the ledger records
 * appear together" has a single spelling.
 *
 * Takes a NOUN or symbol, like {@link formatQuantity} — pass `unitNoun(option)` for a pack.
 */
export function formatQuantityEcho(quantity: number, unitLabel: string | null | undefined): string {
  return `= ${formatQuantity(quantity, unitLabel)}`
}

/**
 * A field label that names the unit its number is counted in — `("Opening stock", bagOption)` →
 * `"Opening stock (bags)"`, `("Opening stock", kgOption)` → `"Opening stock (kg)"`.
 *
 * `UNIT_UX_CONTRACT.md` §9.1 made two catalog quantities — `opening_stock` and
 * `low_stock_alert_at` — count **packs** whenever the row declares one and stock units when it
 * does not, with no column stating which because the row already does. On a spreadsheet that
 * works: the pack columns are on the same row, a few cells to the left. On a form it does not,
 * because the reader is looking at one field at a time. So the field says it.
 *
 * That is the whole fix for the reported failure: someone typed twelve into a field labelled only
 * "Opening stock", meaning twelve 40 kg bags, and got 12 kg. The label is plural because the
 * number will usually be ("Opening stock (bags)"), and symbols are never pluralised —
 * {@link pluraliseUnitNoun} draws that line.
 *
 * Returns the bare label when there is no unit to name yet — a form where nothing has been
 * chosen must not assert "(units)" about a product whose stock unit is one field away from being
 * set.
 */
export function fieldLabelInUnit(label: string, option: UnitOption | null | undefined): string {
  if (option == null) return label
  return `${label} (${pluraliseUnitNoun(unitNoun(option), 2)})`
}

/**
 * Every valid answer for "counted in", on one line: `"kg · or Bag of 50 kg"`.
 *
 * `UNIT_UX_CONTRACT.md` §5.2's `how_you_count_it` column, and the same string is worth showing
 * anywhere a unit picker could look arbitrary. The reported complaint in the plan's preamble is
 * precisely a question asked without its valid answers on screen; this is the answer list.
 */
export function howYouCountIt(options: UnitOption[]): string {
  if (options.length === 0) return UNIT_COPY.NO_UNIT_LABEL
  return options.map((option) => option.label).join(' · or ')
}

/**
 * The whole mental model in one sentence, for under the product form's pack group:
 * *"One bag = 50 kg. You'll be able to enter stock in either."*
 *
 * Plan §6.1 asks for exactly this line and gives the reason: the relationship between the three
 * fields is the thing users get wrong, and stating it once at the point of configuration is
 * cheaper than explaining it at every later point of entry. Returns `null` when there is no pack
 * configured yet — there is no relationship to state, and a half-built sentence is worse than
 * silence.
 */
export function packSummarySentence(
  packagingLabel: string | null | undefined,
  packagingSize: number | null | undefined,
  stockUnitSymbolText: string | null | undefined,
): string | null {
  if (!packagingLabel || !stockUnitSymbolText) return null
  if (packagingSize == null || Number.isNaN(packagingSize) || packagingSize <= 0) return null
  const noun = /^[A-Z][a-z]/.test(packagingLabel)
    ? packagingLabel.charAt(0).toLowerCase() + packagingLabel.slice(1)
    : packagingLabel
  return `One ${noun} = ${formatNumber(packagingSize)} ${stockUnitSymbolText}. You'll be able to enter stock in either.`
}

/**
 * The live suffix under "Units per pack" — `"50 kg per bag"`, or `"kg per bag"` before a number
 * has been typed.
 *
 * Plan §6.1: the field explains itself instead of leaning on a static example sentence
 * underneath the whole group. "Units per pack" alone leaves "units of what?" unanswered, and the
 * answer is already on screen in the Stock unit select — so it is read from there and repeated
 * here, live, rather than left to be inferred one field away. Katana and inFlow both do this,
 * rendering entry as "N packs (= M base)" with the base unit named at all times.
 */
export function unitsPerPackHint(
  packagingSize: number | null | undefined,
  stockUnitSymbolText: string | null | undefined,
  packagingLabel: string | null | undefined,
): string | null {
  if (!stockUnitSymbolText || !packagingLabel) return null
  const noun = /^[A-Z][a-z]/.test(packagingLabel)
    ? packagingLabel.charAt(0).toLowerCase() + packagingLabel.slice(1)
    : packagingLabel
  if (packagingSize == null || Number.isNaN(packagingSize) || packagingSize <= 0) {
    return `How many ${stockUnitSymbolText} are in one ${noun}`
  }
  return `${formatNumber(packagingSize)} ${stockUnitSymbolText} per ${noun}`
}

/**
 * States where a typed price actually lands — for any form whose price field is entered in a
 * pack but stored per stock unit.
 *
 * `UNIT_UX_CONTRACT.md` §3.2 makes every stored price per stock unit (`Product.costPrice`,
 * `ProductVendor.lastCostPrice`, `ProductVendorPriceTier.unitPrice`,
 * `StockMovement.unitPriceAtTime`). That normalisation is what makes two suppliers with
 * different pack sizes comparable at all — and it is invisible unless a sentence says so, which
 * is how plan §3's P0-2 shipped a price tier meaning "at 500 kg, ₦44,000 per bag".
 */
export function priceBasisNote(stockUnitLabel: string): string {
  return `Saved as ₦ per ${stockUnitLabel}. Every price is stored per ${UNIT_COPY.STOCK_UNIT.toLowerCase()}, so suppliers with different pack sizes stay comparable.`
}

/**
 * The client-side twin of `UNIT_UX_CONTRACT.md` §3.1's round-to-zero refusal, so a form can say
 * it before the request rather than surfacing a 400.
 *
 * A conversion that rounds to nothing must never be written as a silent `0` — that is a
 * disappearing delivery. The message names the way out (both ways out) rather than only
 * reporting the refusal.
 */
export function roundsToZeroMessage(quantity: number, option: UnitOption, stockUnitLabel: string): string {
  return `${formatQuantityInUnit(quantity, option)} is less than one whole ${stockUnitLabel} — enter a larger amount, or change this product's ${UNIT_COPY.STOCK_UNIT.toLowerCase()}.`
}
