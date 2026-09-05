import type { UnitOfMeasureOption, UnitOption } from '@/features/products/types'
import { UNIT_COPY, packPhrase, stockUnitSymbol } from '@/features/products/unitCopy'

/**
 * A product's **unit set** — the closed list of units a quantity for that product may be entered
 * in — plus the arithmetic that converts into and out of it.
 *
 * <h2>What this replaces, and why it had to be replaced</h2>
 * `stockUnitMath.toBaseQuantity` (still present, now a deprecated shim) ended with:
 *
 * ```ts
 * return quantity   // "whenever there's no known conversion rate for the given code"
 * ```
 *
 * That line is `UNIT_UX_REMEDIATION_PLAN.md` §3's P1-1/P1-2 in one statement. The advanced
 * stock-in disclosure offered ~30 unit codes; picking any of them the product was not configured
 * with produced a quantity passed through UNCHANGED on the client — so the "= 1,000 kg" preview
 * silently went dark, the confirm screen read "5 cartons", and the server either 400'd or took a
 * completely different number. A conversion helper that cannot convert must refuse, not shrug.
 *
 * So conversion here is expressed against a `UnitOption` rather than against a loose `(unit,
 * packagingUnit, packagingSize)` triple. A `UnitOption` always carries a real
 * `factorToStockUnit`; if a unit is not in the set there is no option to pass, and the caller is
 * forced to handle that rather than accidentally not handling it. That is the whole design.
 *
 * <h2>Prior art</h2>
 * This is Zoho Inventory's *Unit Group* model and Odoo's *UoM category* model, both of which
 * constrain a product's enterable units to a derived, factor-bearing set configured on the
 * product itself, and neither of which offers a "full list" escape hatch — because a unit with
 * no factor is not an alternative unit, it is an unanswerable question (plan §4). NetSuite's
 * Units Type record is the same idea with base/purchase/sale roles layered on.
 *
 * <h2>Contract references</h2>
 * `UNIT_UX_CONTRACT.md` §2 (the `UnitOption` shape and §2.1's build algorithm), §2.2 (static
 * base-unit factors), §3.1 (quantity rounding and the round-to-zero refusal), §3.2 (price
 * division). Every rounding scale below is the contract's, not a guess — the previews this
 * module feeds must state the number the ledger will actually record, per §7.3.
 */

/** The subset of `Product` this module needs. Kept structural so a form's live values, a
 *  `Product` from the API and an import row can all be passed without adapting. */
export interface UnitConfigurable {
  unitOfMeasure?: string | null
  packagingUnit?: string | null
  packagingSize?: number | null
}

/** A pack, wherever it comes from: the product's own, a supplier's default, or a one-off
 *  override for a single delivery (`UNIT_UX_CONTRACT.md` §3.1's per-request extension). */
export interface PackConfiguration {
  packagingUnit?: string | null
  packagingSize?: number | null
}

/**
 * A supplier line as it arrives on the wire. `ProductVendor.packs` is the actual data now
 * (MULTI_PACK_PER_VENDOR_DESIGN.md sections 4–7 — a vendor is no longer limited to one pack);
 * `defaultPackagingUnit`/`defaultPackagingSize` stay on the response as a permanent alias for the
 * default pack, and this module reads `packs` directly rather than the alias.
 *
 * Structural rather than a `ProductVendor` import so a supplier picker's lighter row, or a
 * not-yet-saved form value, can be passed without adapting. {@link supplierPack} and
 * {@link supplierPacks} are the two places that read `packs`, so no other caller has to know its
 * shape.
 */
export interface SupplierPackSource {
  packs?: SupplierPackEntry[] | null
  unitOptions?: UnitOption[] | null
}

/** One entry of `ProductVendor.packs` — just the fields this module needs. */
export interface SupplierPackEntry {
  packagingUnit?: string | null
  packagingSize?: number | null
  isDefault?: boolean
}

/** This supplier's DEFAULT pack, as a plain {@link PackConfiguration} — what a per-vendor summary
 *  (the Vendors tab's collapsed row) shows before any one pack is chosen. `null` when the vendor
 *  has no packs at all, or none marked default. */
export function supplierPack(supplier: SupplierPackSource | null | undefined): PackConfiguration | null {
  const pack = supplier?.packs?.find((p) => p.isDefault)
  return pack ? { packagingUnit: pack.packagingUnit, packagingSize: pack.packagingSize } : null
}

/** Every one of this supplier's packs, as plain {@link PackConfiguration}s — §2.1 step 3's input
 *  now that a vendor can have more than one. */
export function supplierPacks(supplier: SupplierPackSource | null | undefined): PackConfiguration[] {
  return (supplier?.packs ?? []).map((p) => ({ packagingUnit: p.packagingUnit, packagingSize: p.packagingSize }))
}

/**
 * The single-entry set for a product with no stock unit at all — `UNIT_UX_CONTRACT.md` §2.1's
 * explicit tail case, the pre-V17 product that never got one. Callers must handle it, which is
 * exactly why it is a real option rather than an empty array: an empty array turns into a
 * disabled control and a mystery, whereas this turns into "1,000 units" and a working form.
 */
export const NO_UNIT_OPTION: UnitOption = {
  code: '',
  label: UNIT_COPY.NO_UNIT_LABEL,
  factorToStockUnit: 1,
  isStockUnit: true,
  isDefault: true,
  isPack: false,
}

/**
 * Float-safe HALF_UP rounding at a given scale, matching the `BigDecimal` the server rounds with.
 *
 * The naive `Math.round(v * 10 ** d) / 10 ** d` gets `1.005` at scale 2 wrong (it becomes 1.00,
 * because 1.005 is really 1.00499999999999989 in binary). Shifting through the decimal exponent
 * in a string sidesteps that. Half-way values go up, as `RoundingMode.HALF_UP` does — the two
 * diverge only for negative inputs, and neither a quantity nor a price is ever negative here.
 */
function roundHalfUp(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return 0
  const shifted = Number(`${value}e${decimals}`)
  if (!Number.isFinite(shifted)) {
    const factor = 10 ** decimals
    return Math.round(value * factor) / factor
  }
  const restored = Number(`${Math.round(shifted)}e${-decimals}`)
  return Number.isFinite(restored) ? restored : Math.round(shifted) / 10 ** decimals
}

/** `"KG"` → `"Kilogram (kg)"`. Undefined for a code the fetched list does not carry — a unit
 *  request that has not landed in the static list yet, which must not crash a table. */
export function resolveUnitLabel(
  code: string | null | undefined,
  unitsOfMeasure: UnitOfMeasureOption[],
): string | undefined {
  if (!code) return undefined
  return unitsOfMeasure.find((option) => option.code === code)?.label
}

/**
 * `"KG"` → `"kg"`. The short form every quantity on screen is suffixed with.
 *
 * Prefers the server's own `symbol` (`UnitOfMeasureResponse` publishes it precisely so no client
 * keeps a second table of which label abbreviates to what) and falls back to parsing the label's
 * parenthetical via `unitCopy.stockUnitSymbol` — which keeps this correct against a response that
 * predates the field, and against a code the fetched list does not carry at all.
 *
 * Use this rather than `stockUnitSymbol(resolveUnitLabel(...))` anywhere a code is what you hold;
 * reserve `stockUnitSymbol` for when a label is all you have.
 */
export function resolveUnitSymbol(
  code: string | null | undefined,
  unitsOfMeasure: UnitOfMeasureOption[],
): string {
  if (!code) return UNIT_COPY.NO_UNIT_LABEL
  const match = unitsOfMeasure.find((option) => option.code === code)
  if (match?.symbol) return match.symbol
  return stockUnitSymbol(match?.label ?? code)
}

/**
 * One pack rendered as a `UnitOption` — `{ code: "BAG", label: "Bag of 50 kg",
 * factorToStockUnit: 50 }`.
 *
 * Returns `null` rather than a factor-less option when the pack is half-configured (a unit with
 * no size, or a size of zero). `UNIT_UX_CONTRACT.md` §7.1: no quantity field anywhere offers a
 * unit with no conversion factor, so a pack we cannot convert simply is not an option.
 */
export function buildPackOption(
  pack: PackConfiguration | null | undefined,
  stockUnitSymbolText: string,
  unitsOfMeasure: UnitOfMeasureOption[],
): UnitOption | null {
  if (pack?.packagingUnit == null || pack.packagingUnit.length === 0) return null
  const size = pack.packagingSize
  if (size == null || Number.isNaN(size) || size <= 0) return null

  const packagingLabel = resolveUnitLabel(pack.packagingUnit, unitsOfMeasure) ?? pack.packagingUnit
  const label = packPhrase(packagingLabel, size, stockUnitSymbolText)
  if (label == null) return null

  return { code: pack.packagingUnit, label, factorToStockUnit: size, isStockUnit: false, isDefault: false, isPack: true }
}

export interface BuildUnitOptionsInput {
  /** The product's own stock unit and pack. */
  product: UnitConfigurable
  /** The fetched list from `GET /api/products/units-of-measure` — supplies labels, and (once M1
   *  lands it) the `factorToCanonical` that step 4's same-category base units depend on. */
  unitsOfMeasure: UnitOfMeasureOption[]
  /** §2.1 step 3 — every one of a supplier's own packs. Omit (or empty) for a product-scoped set. */
  supplier?: PackConfiguration[] | null
  /**
   * §3.1's per-request override: a pack that applies to THIS delivery only. It *extends* the set,
   * it does not replace it and it does not bypass matching — and it must never write itself back
   * to configuration (§7.7 / plan P0-5).
   */
  extraPack?: PackConfiguration | null
  /**
   * The server-composed set from `ProductResponse.unitOptions` /
   * `ProductVendorResponse.unitOptions` (§2.3), when the response carried one.
   *
   * Preferred verbatim when present — the server is the authority, its list is what request
   * validation will be run against, and re-deriving it here would be a second implementation of
   * §2.1 free to drift from the first. The local derivation below is the fallback for responses
   * that predate M1 and for live form values that have not been saved yet (the product form
   * previews a pack the server has never seen).
   */
  serverOptions?: UnitOption[] | null
}

/**
 * `UNIT_UX_CONTRACT.md` §2.1's algorithm: stock unit, then the product's own pack, then EVERY
 * ONE of the supplier's packs, then same-category base units — deduplicated by `(code, size)`,
 * first occurrence wins, exactly one `isDefault`.
 *
 * <h3>Why dedup is by `(code, size)`, not `code` alone</h3>
 * It used to be `code` alone, and that was the bug (MULTI_PACK_PER_VENDOR_DESIGN.md section 5): a
 * supplier who delivers the same product in a 25 kg bag when the product's own pack is a 50 kg bag
 * contributed nothing to the set, because both were `BAG`. Two entries with the same code AND the
 * same size really are the same unit and still collapse to one; two with the same code and
 * DIFFERENT sizes are genuinely different options now, distinguished by their label — "Bag of
 * 25 kg" vs "Bag of 50 kg" — which already states the size. `unit` on the wire is still a bare
 * code, so the interactive stock-in form must send `packagingUnit`/`packagingSize` alongside it
 * whenever the resolved option {@link UnitOption.isPack} — see `StockInModal.submit`.
 */
export function buildUnitOptions(input: BuildUnitOptionsInput): UnitOption[] {
  const { product, unitsOfMeasure, supplier, extraPack, serverOptions } = input

  const stockCode = product.unitOfMeasure ?? ''
  const stockSymbol = resolveUnitSymbol(stockCode, unitsOfMeasure)

  const collected: UnitOption[] = []
  const seen = new Set<string>()
  function keyOf(option: UnitOption): string {
    return `${option.code}|${option.factorToStockUnit}`
  }
  function add(option: UnitOption | null) {
    if (option == null || seen.has(keyOf(option))) return
    seen.add(keyOf(option))
    collected.push(option)
  }

  if (serverOptions != null && serverOptions.length > 0) {
    for (const option of serverOptions) add(option)
  } else if (stockCode.length === 0) {
    // §2.1's tail case. A pack of "50" with nothing to be 50 OF is not a conversion, so no pack
    // is offered here — not even a per-request one.
    add({ ...NO_UNIT_OPTION })
  } else {
    add({ code: stockCode, label: stockSymbol, factorToStockUnit: 1, isStockUnit: true, isDefault: false, isPack: false })
    add(buildPackOption(product, stockSymbol, unitsOfMeasure))
    for (const pack of supplier ?? []) add(buildPackOption(pack, stockSymbol, unitsOfMeasure))
    for (const option of sameCategoryBaseOptions(stockCode, unitsOfMeasure)) add(option)
  }

  // Applied after the server's list as well as after the local one: a one-off pack for a single
  // delivery extends whatever the set already was, per §3.1.
  //
  // REPLACE IN PLACE, not first-occurrence-wins — this must mirror the server's
  // `UnitOptions.extendedWith` exactly, and `add()` above cannot do it. A delivery whose pack
  // shares a CODE with one already in the set but differs in SIZE ("Bag of 25 kg" against a
  // product packed in "Bag of 50 kg") is the whole reason the override exists. Under `add()`'s
  // dedup the override was silently dropped while the server honoured it, so the toggle read
  // "Bag of 50 kg" and previewed 1,000 kg for a delivery the ledger recorded as 500 — a
  // divergence between what the screen says and what is stored, which is the exact class of
  // defect this remediation exists to eliminate. Found by M5, which worked around it locally;
  // fixed here so no later caller inherits it.
  if (extraPack && stockCode.length > 0) {
    const override = buildPackOption(extraPack, stockSymbol, unitsOfMeasure)
    if (override != null) {
      const existing = collected.findIndex((option) => option.code === override.code)
      if (existing >= 0) collected[existing] = override
      else add(override)
    }
  }

  return withSingleDefault(collected, product)
}

/**
 * §2.1 step 4 — the other base units of the stock unit's own category, e.g. a KG product also
 * accepting `T` and `G`. Closes plan §3's P1-7: the picker already GROUPED kg/g/t by category
 * while storing no factors, so it looked like a conversion existed and none did.
 *
 * `factorToCanonical` is M1's new column (§2.2). Anything missing it — every PACKAGING-role
 * constant, and the whole list until M1 ships — contributes nothing, which degrades to today's
 * behaviour rather than to a wrong number. Cross-category is never attempted: weight to volume
 * is not a conversion without a density, and offering it would be worse than not offering it.
 */
function sameCategoryBaseOptions(stockCode: string, unitsOfMeasure: UnitOfMeasureOption[]): UnitOption[] {
  const stockUnit = unitsOfMeasure.find((option) => option.code === stockCode)
  const stockFactor = stockUnit?.factorToCanonical
  if (!stockUnit || stockFactor == null || Number.isNaN(stockFactor) || stockFactor <= 0) return []

  return unitsOfMeasure
    .filter(
      (option) =>
        option.role === 'BASE' &&
        option.category === stockUnit.category &&
        option.code !== stockCode &&
        option.factorToCanonical != null &&
        !Number.isNaN(option.factorToCanonical) &&
        option.factorToCanonical > 0,
    )
    .map((option) => ({
      code: option.code,
      label: option.symbol ?? stockUnitSymbol(option.label),
      // §2.2: cross-base factor from A to stock unit B is A.factorToCanonical / B.factorToCanonical,
      // scale 9, HALF_UP.
      factorToStockUnit: roundHalfUp((option.factorToCanonical as number) / stockFactor, 9),
      isStockUnit: false,
      isDefault: false,
    }))
}

/**
 * §2.1's closing rule: exactly one `isDefault` per set — the product's own pack if it has one,
 * else the stock unit.
 *
 * Enforced here even over a server-composed list, because "exactly one" is what every consumer
 * assumes when it preselects a form value, and two (or none) turns into either a silently wrong
 * default or an empty required field with no error attached to it.
 */
function withSingleDefault(options: UnitOption[], product: UnitConfigurable): UnitOption[] {
  if (options.length === 0) return [{ ...NO_UNIT_OPTION }]

  const productPackCode = product.packagingUnit ?? ''
  const preferred =
    (productPackCode.length > 0 ? options.find((option) => option.code === productPackCode) : undefined) ??
    options.find((option) => option.isStockUnit) ??
    options[0]

  return options.map((option) => ({ ...option, isDefault: option === preferred }))
}

/** A product-scoped set — §2.3's `ProductResponse.unitOptions`: steps 1, 2 and 4, no supplier packs. */
export function unitOptionsForProduct(
  product: UnitConfigurable & { unitOptions?: UnitOption[] | null },
  unitsOfMeasure: UnitOfMeasureOption[],
): UnitOption[] {
  return buildUnitOptions({ product, unitsOfMeasure, serverOptions: product.unitOptions ?? null })
}

/** A supplier-scoped set — §2.3's `ProductVendorResponse.unitOptions`: steps 1, 2, 3 and 4. What
 *  the stock-in form switches to once a supplier is chosen. */
export function unitOptionsForSupplier(
  product: UnitConfigurable,
  supplier: SupplierPackSource | null | undefined,
  unitsOfMeasure: UnitOfMeasureOption[],
): UnitOption[] {
  return buildUnitOptions({
    product,
    unitsOfMeasure,
    supplier: supplierPacks(supplier),
    serverOptions: supplier?.unitOptions ?? null,
  })
}

/** The option a form preselects. Never undefined — `withSingleDefault` guarantees one, and this
 *  falls back to the first entry rather than returning a nullable a caller would have to guard. */
/**
 * The ways this product is actually bought and sold — its stock unit and its packs (§2.1 steps
 * 1–3), without step 4's same-category base units.
 *
 * <h2>Why a quantity control offers this and not the whole set</h2>
 * Step 4 adds real, correct conversions (a KG product also accepts `g` and `t`), and they belong
 * in the set: someone genuinely does buy a tonne of rice. But they are not how anyone *describes*
 * a delivery, and mixing them into the same dropdown is what made a millimetre product read
 * "mm · or Dozen of 12 mm · or cm · or m" — four options of which two are the answer. A user
 * reported that as confusing, and they were right.
 *
 * The spreadsheet already draws exactly this line: `how_you_count_it` prints steps 1–3 only, with
 * "other sizes of the same measure work too" left to the header comment (`UNIT_UX_CONTRACT.md`
 * §5.2, amended for this reason). This is the same line on screen — the common control stays
 * short, and the full set stays one disclosure away.
 */
export function productsOwnUnits(options: UnitOption[]): UnitOption[] {
  const own = options.filter((option) => option.isStockUnit || option.isPack)
  return own.length > 0 ? own : options
}

export function defaultUnitOption(options: UnitOption[]): UnitOption {
  return options.find((option) => option.isDefault) ?? options[0] ?? { ...NO_UNIT_OPTION }
}

/**
 * The set's stock-unit entry — what every stored quantity and price is expressed in.
 *
 * <h2>Also the issuing default — `UNIT_UX_CONTRACT.md` §9.3</h2>
 * §9.3 makes entry defaults **direction-aware**, and this function is one half of that pair:
 *
 * | Surface | Preselect | Why |
 * |---|---|---|
 * | Stock **in**, catalog opening stock | {@link defaultUnitOption} — the pack | deliveries arrive in bags; an invoice counts bags |
 * | Stock **out** | this — the stock unit | you buy a bag and sell 5 kg out of it |
 *
 * That is NetSuite's purchase-unit / sale-unit split and Odoo's Purchase-UoM-vs-UoM split, whose
 * delivery-order lines likewise default to the product's own unit rather than a packaging. It
 * needs no wire change and no second flag on `UnitOption` (§9.3 forbids one): both options are
 * already in the set, and choosing between them is this one line at each call site.
 *
 * Never undefined — a set always has a stock-unit entry (§2.1 step 1), and the fallbacks exist
 * only so a caller holding an empty array gets a working form rather than a crash.
 */
export function stockUnitOption(options: UnitOption[]): UnitOption {
  return options.find((option) => option.isStockUnit) ?? options[0] ?? { ...NO_UNIT_OPTION }
}

/** The short symbol every base-unit figure on screen is labelled with — `"kg"`. */
export function stockUnitLabel(options: UnitOption[]): string {
  return stockUnitOption(options).label
}

/**
 * Resolve a wire `unit` back to its option. `undefined` when the code is not in the set — which
 * is the point: §3.1 makes an unmatched code a 400, so the client must be able to see the same
 * "no match" the server will, rather than converting by 1 and hoping.
 *
 * A null/blank code means the stock unit, unchanged from today's wire behaviour (§3.1, §7.8).
 */
export function findUnitOption(options: UnitOption[], code: string | null | undefined): UnitOption | undefined {
  if (code == null || code.length === 0) return stockUnitOption(options)
  return options.find((option) => option.code === code)
}

/**
 * `UNIT_UX_CONTRACT.md` §3.1: `baseQuantity = round(quantity × factorToStockUnit)`, HALF_UP,
 * scale 0.
 *
 * Rounds here, on the client, on purpose — §7.3 requires the preview to show the number the
 * ledger will actually record, and a preview that reads "20.4 kg" against a stored 20 is a
 * smaller lie than the old silent pass-through but still a lie.
 */
export function toBaseQuantity(quantity: number, option: UnitOption): number {
  if (!Number.isFinite(quantity)) return 0
  return roundHalfUp(quantity * option.factorToStockUnit, 0)
}

/**
 * Base units back into an entry unit — `1,000 kg` → `20 bags`. Scale 3, the widest the schema's
 * `numeric(14,3)` quantity columns carry.
 *
 * Not the inverse of {@link toBaseQuantity} for every input, and deliberately not presented as
 * one: 1,010 kg is 20.2 bags, and rounding that to 20 would be inventing 10 kg. Use it for
 * "(190 bags)" style parentheticals beside a stock-unit figure, never to derive a number to send.
 */
export function fromBaseQuantity(baseQuantity: number, option: UnitOption): number {
  if (!Number.isFinite(baseQuantity) || option.factorToStockUnit === 0) return 0
  return roundHalfUp(baseQuantity / option.factorToStockUnit, 3)
}

/**
 * `UNIT_UX_CONTRACT.md` §3.2 — the symmetric half that did not exist: `resolveBasePrice =
 * enteredPrice / factorToStockUnit`, scale 6, HALF_UP.
 *
 * This is the fix for the load-bearing bug. Quantity was converted underneath a price that was
 * not, so *20 bags @ ₦45,000/bag* on a KG/BAG/50 product wrote ₦45,000 **per kg** into the
 * catalog cost price — a 50× error, silent, and then compounded into every later weighted
 * average (plan §3's P0-1). Divide, do not multiply: a price is per-unit, so a bigger unit means
 * a bigger number, and the base-unit price is the smaller one.
 *
 * Scale 6 before persistence, matching the contract's "do the arithmetic at scale 6 first" —
 * ₦45,000 across a 700-piece carton is ₦64.285714, and rounding that to kobo before it reaches
 * the weighted average would drift a large catalog.
 */
export function toBasePrice(enteredPrice: number, option: UnitOption): number {
  if (!Number.isFinite(enteredPrice) || option.factorToStockUnit === 0) return 0
  return roundHalfUp(enteredPrice / option.factorToStockUnit, 6)
}

/** The other direction — a stored per-stock-unit price shown in a pack's terms, e.g. a
 *  `lastCostPrice` of ₦900/kg rendered as ₦45,000/bag. Display only. */
export function fromBasePrice(basePrice: number, option: UnitOption): number {
  if (!Number.isFinite(basePrice)) return 0
  return roundHalfUp(basePrice * option.factorToStockUnit, 6)
}

/**
 * `UNIT_UX_CONTRACT.md` §3.1's round-to-zero guard: *a conversion that rounds to zero ⇒ 400,
 * never a silent 0.*
 *
 * `false` means "this quantity is real but disappears when converted" — 1 g against a KG stock
 * unit. The client checks it so the form can say so next to the field (with
 * `unitCopy.roundsToZeroMessage`) instead of round-tripping to a server error, and a zero
 * quantity is not the caller's problem: `convertsCleanly(0, …)` is `true`, because zero was
 * already nothing before the conversion touched it.
 */
export function convertsCleanly(quantity: number, option: UnitOption): boolean {
  if (!Number.isFinite(quantity) || quantity <= 0) return true
  return toBaseQuantity(quantity, option) > 0
}
