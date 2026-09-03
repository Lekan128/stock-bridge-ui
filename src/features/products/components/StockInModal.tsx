import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Package, Truck } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { Modal } from '@/components/Modal'
import { TextField } from '@/components/TextField'
import { stockApi, type StockInRequestPayload } from '@/features/products/api/stockApi'
import { UnitToggle } from '@/features/products/components/UnitToggle'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import { useProductVendors } from '@/features/products/hooks/useProductVendors'
import { makeStockInSchema, type StockInFormValues } from '@/features/products/schemas'
import type { Product, StockMutationResponse, UnitOption } from '@/features/products/types'
import {
  UNIT_COPY,
  formatEnteredAndBase,
  formatPackCostEcho,
  formatPriceEcho,
  formatPricePer,
  formatPricePerOption,
  formatQuantity,
  howYouCountIt,
  priceBasisNote,
  roundsToZeroMessage,
  unitNoun,
  unitsPerPackHint,
} from '@/features/products/unitCopy'
import {
  buildPackOption,
  convertsCleanly,
  defaultUnitOption,
  productsOwnUnits,
  resolveUnitLabel,
  stockUnitLabel,
  toBasePrice,
  toBaseQuantity,
  unitOptionsForProduct,
  unitOptionsForSupplier,
} from '@/features/products/unitSet'
import type { ProductVendor } from '@/features/products/vendors/types'
import { useVendorOptions } from '@/features/vendors/hooks/useVendorOptions'
import { isAppError } from '@/types/api'

export interface StockInModalProps {
  product: Product
  onClose: () => void
  onSuccess: (result: StockMutationResponse) => void
}

type Step = 'form' | 'confirm' | 'receipt'

/** Best applicable price for `vendor` at `baseQuantity` — highest-`minQuantity` tier that still
 *  qualifies, falling back to the flat `lastCostPrice` when the supplier has no tiers (or none
 *  qualify yet). `null` when nothing is known about this supplier's price at all.
 *
 *  Every figure involved is **per stock unit** — `minQuantity`, `unitPrice` and `lastCostPrice`
 *  alike (`UNIT_UX_CONTRACT.md` §3.2). That is new, and it is what makes this comparison mean
 *  anything: before price normalisation a tier row meant "at 500 kg, ₦44,000 per bag" and was
 *  being compared against a `lastCostPrice` of unknown basis (plan §3's P0-2 — three numbers,
 *  three possible bases, one comparison). So `baseQuantity` must be passed in base units, which
 *  is why the caller converts through `toBaseQuantity` first rather than passing what was typed. */
function resolvedVendorPrice(vendor: ProductVendor, baseQuantity: number): number | null {
  if (vendor.priceTiers.length > 0) {
    const applicable = [...vendor.priceTiers].filter((t) => baseQuantity >= t.minQuantity).sort((a, b) => b.minQuantity - a.minQuantity)[0]
    if (applicable) return applicable.unitPrice
  }
  return vendor.lastCostPrice ?? null
}

/**
 * `UNIT_UX_CONTRACT.md` §3.1's per-request pack override, applied to a unit set: **it extends the
 * set, it does not bypass matching.**
 *
 * Mirrors the server's `UnitOptions.extendedWith` deliberately and exactly, including the part
 * that is easy to get wrong: an override naming a container the set already has — the ordinary
 * *"this delivery came in a 25 kg bag rather than the usual 50"* case — **replaces** that entry
 * in place, keeping its position and its `isDefault`, rather than being dropped as a duplicate. A
 * set with two different "Bag of N" entries asks an impossible question (the wire's `unit` is a
 * code, so both would be `BAG` and neither could be resolved), and dropping the override instead
 * would be worse still: the toggle would read "Bag of 50 kg" while the user had just said 25, and
 * 20 bags would be recorded as 1,000 kg instead of 500.
 *
 * `unitSet.buildUnitOptions`'s own `extraPack` is first-occurrence-wins and so cannot express the
 * replacement; that is the one reason this merge lives here rather than being delegated.
 */
function withDeliveryPack(options: UnitOption[], deliveryPack: UnitOption | null): UnitOption[] {
  if (deliveryPack == null) return options
  let replaced = false
  const merged = options.map((option) => {
    if (option.isStockUnit || option.code.toUpperCase() !== deliveryPack.code.toUpperCase()) return option
    replaced = true
    return { ...deliveryPack, isDefault: option.isDefault }
  })
  return replaced ? merged : [...merged, deliveryPack]
}

/**
 * Stock-in — the screen the reported complaint was about, rebuilt per `UNIT_UX_CONTRACT.md` §3
 * and `UNIT_UX_REMEDIATION_PLAN.md` §6.2 on top of the multi-vendor inventory design (§6, §7.3).
 *
 * <h2>What was wrong, in the user's own words</h2>
 * *"When adding to the stock, it gives the toggle of the measurement and package as, but after
 * trying to use the advance add, the product that is going to be added is totally inconsistent
 * with what is expected in the input and the user has to make a lot of guesses."*
 *
 * Three separate defects produced that one sentence, and all three are closed here:
 * <ol>
 *   <li><b>P1-1.</b> An advanced "Unit (full list, for a one-off delivery unit)" select offered
 *       ~30 codes while the server accepted two. Every code in it other than this product's own
 *       pack was a guaranteed 400 unless the user independently discovered that they also had to
 *       set "Delivered as" and "Pack size" two fields below — and nothing on screen connected the
 *       three. It is <b>deleted</b>, not repaired (non-negotiable 1): a unit with no conversion
 *       factor is not an alternative unit, it is an unanswerable question. {@link UnitToggle} is
 *       now the only unit control and its options are the product's derived unit set (§2), so
 *       every option carries a real factor by construction.</li>
 *   <li><b>P1-2.</b> The "= 1,000 kg" preview was gated on
 *       {@code unit === product.packagingUnit}, which ignored the pack override entirely — so the
 *       conversion line went dark on exactly the path where a conversion was happening, and the
 *       confirm screen read "5 cartons" while the ledger took 60 kg. The override now ADDS its
 *       pack to the unit set ({@link withDeliveryPack}), so the preview is computed from the same
 *       factor the server will use and never goes dark.</li>
 *   <li><b>P0-1.</b> Unit price was labelled "per {entered unit}" and sent unconverted into a
 *       per-stock-unit column: <em>20 bags @ ₦45,000/bag</em> on a 50 kg-bag product wrote
 *       ₦45,000 <b>per kg</b>, a fifty-fold error compounded into every later weighted average.
 *       The field now names its basis in its own label ("Unit price (₦ per bag)") and shows the
 *       per-stock-unit figure live beneath it (§3.2, non-negotiable 2). What is sent is what was
 *       typed; the server divides.</li>
 * </ol>
 *
 * <h2>It defaults to the pack, and stock-out does not — `UNIT_UX_CONTRACT.md` §9.3</h2>
 * One rule used to drive both stock modals. §9.3 splits them by direction: this screen preselects
 * `defaultUnitOption` (the pack — deliveries arrive in bags, an invoice counts bags) and
 * `StockOutModal` preselects `stockUnitOption` (you buy a bag and sell 5 kg out of it). It is
 * NetSuite's purchase-unit / sale-unit split and Odoo's Purchase-UoM-vs-UoM split. See
 * `selectedOption`.
 *
 * <h2>Two price echoes, never both at once — §9.2</h2>
 * The unit price is entered per the selected unit and stored per stock unit, so which of the two
 * numbers needs checking depends on the toggle. `packCostEcho` documents the pair in full; the
 * short version is that the field always shows the figure its own label does not name, and never
 * a restatement of the one it does.
 *
 * <h2>Step machine</h2>
 * `form` → (validated) → `confirm` → (submits) → `receipt`. `Edit` on the confirm screen goes
 * back to `form` with every value intact (it's the same react-hook-form instance, nothing is
 * cleared). The receipt step is a deliberate pause before calling `onSuccess` — the parent
 * (`ProductDetailPage`) closes this modal the instant `onSuccess` fires, so calling it eagerly on
 * a bare "200 OK" would skip the receipt-style breakdown the design asks for entirely.
 *
 * <h2>Supplier field visibility — the one place this component earns its complexity</h2>
 * Unchanged in substance and still correct; only the word for it changed (§1: `CompanyVendor` is
 * a **Supplier**). Sourced from `useProductVendors` (this product's OWN supplier lines, not the
 * company's whole directory):
 * - 0 suppliers on file: this is the product's first-ever supplier. The picker is shown (sourced
 *   from the company's full directory, `useVendorOptions`), with NO default — the user picks
 *   normally, same as any other required field.
 * - Exactly 1 supplier: no real choice exists, so the field is not rendered at all — that
 *   supplier's id is used silently.
 * - 2+ suppliers: real ambiguity, so the picker is shown, defaulted to whichever is `isPreferred`,
 *   or the first row if none is pinned. The API's `ProductVendor` list has no explicit
 *   "last used" timestamp, so list order is trusted as the "most recently used" proxy per
 *   §7.3 — a judgment call, flagged in the module's final report.
 *
 * <h2>Two named actions, not one unnamed disclosure</h2>
 * Plan §3's P3-1: a single *"Choose vendor / unit manually"* toggle hid four unrelated things —
 * the supplier picker, the full unit list, "Delivered as" and "Pack size" — and named only two of
 * them. The two it did not name were the packaging pair, which were also the two with side
 * effects. It is replaced by two separately named actions, each doing exactly what it says:
 * <ul>
 *   <li><b>"Use a different supplier"</b> — widens the picker from this product's own supplier
 *       lines to the whole directory, and reveals it even in the single-supplier case above. This
 *       is the one genuinely required escape hatch, and the one the old disclosure's own notes
 *       called out: picking a supplier that is real but not yet linked to this product.</li>
 *   <li><b>"This delivery came in a different pack"</b> — reveals {@link UNIT_COPY.PACK} +
 *       {@link UNIT_COPY.UNITS_PER_PACK}, adds that pack to the toggle live, and carries an
 *       explicit, unchecked opt-in for making it the supplier's standing default (§3.4). Until
 *       now the help text promised *"the vendor's default stays unchanged"* while
 *       `ProductVendorService.findOrCreateForReceipt` overwrote it from those very fields
 *       (P0-5); the backend now honours the promise and this checkbox is the only way to break
 *       it, on the same screen, per non-negotiable 7.</li>
 * </ul>
 *
 * <h2>Prior art</h2>
 * Odoo 18's receipt line pairs a quantity with a UoM selector constrained to the product's own
 * UoM category, and does not let a receipt line redefine the product's unit — the escape hatch
 * there is configuring another packaging, a persistent act. Zoho Inventory's Unit Group is the
 * same closed set, and its quantity fields render a selector limited to that group. NetSuite
 * states purchase price **per purchase unit** and converts to base for costing, which is exactly
 * what the price field and its live per-stock-unit line do here.
 */
export function StockInModal({ product, onClose, onSuccess }: StockInModalProps) {
  const { user } = useAuth()
  const canViewVendors = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.VIEW_VENDORS)
  const { vendors: directoryVendors } = useVendorOptions(canViewVendors)
  const { data: productVendors, loading: productVendorsLoading } = useProductVendors(product.id)
  const { options: unitOfMeasureOptions, packagingOptions } = useUnitOfMeasureOptions()

  const [step, setStep] = useState<Step>('form')
  /** "Use a different supplier" — widens the picker to the whole directory. Named, and separate
   *  from the pack disclosure below, per plan §6.2. */
  const [supplierOverride, setSupplierOverride] = useState(false)
  /** "This delivery came in a different pack" — the other named action. */
  const [packOverride, setPackOverride] = useState(false)
  /**
   * The selected unit's `code`, or `null` for "not chosen yet".
   *
   * `null` rather than `''` because `''` is a real code in §2.1's single-entry set (the product
   * that never got a stock unit), and because the selection is resolved BACK through the live
   * option list on every render — see `selectedOption`. That makes an impossible selection
   * self-healing: when the supplier changes, or the pack override is withdrawn, a code that is no
   * longer in the set simply falls back to the set's default instead of sitting there as a value
   * the server would 400 on.
   */
  const [unitCode, setUnitCode] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<StockMutationResponse | null>(null)

  const activeProductVendors = productVendors.filter((v) => v.companyVendorActive)
  const preferredVendor = activeProductVendors.find((v) => v.isPreferred)
  const defaultVendor = preferredVendor ?? activeProductVendors[0] ?? null

  const activeDirectoryVendors = directoryVendors.filter((v) => v.active)
  const directoryOptions = activeDirectoryVendors.map((v) => ({
    id: v.id,
    label: v.kind === 'VERIFIED' ? `${v.name} (ProcurePaddy ${UNIT_COPY.SELLER.toLowerCase()})` : v.name,
  }))
  const vendorFieldVisible = supplierOverride || activeProductVendors.length !== 1
  const vendorOptions: { id: string; label: string }[] =
    supplierOverride || activeProductVendors.length === 0
      ? directoryOptions
      : activeProductVendors.map((v) => ({ id: v.companyVendorId, label: v.companyVendorName }))
  const vendorRequired = vendorFieldVisible && vendorOptions.length > 0

  const schema = makeStockInSchema(vendorRequired)
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<StockInFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      quantity: '',
      unitPrice: '',
      companyVendorId: '',
      packagingUnit: '',
      packagingSize: '',
      saveAsSupplierDefault: false,
      note: '',
    },
  })

  // Silently defaults the supplier once its data is known — for a single existing supplier (no
  // field shown) as much as for a preferred/most-recent one among several (field shown,
  // pre-filled). Never overwrites a value the user (or a prior default) already set.
  useEffect(() => {
    if (productVendorsLoading) return
    if (getValues('companyVendorId')) return
    if (defaultVendor) setValue('companyVendorId', defaultVendor.companyVendorId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productVendorsLoading, defaultVendor?.companyVendorId])

  const companyVendorId = watch('companyVendorId')
  const quantityStr = watch('quantity')
  const unitPriceStr = watch('unitPrice')
  const overridePackUnit = watch('packagingUnit')
  const overridePackSize = watch('packagingSize')
  const saveAsSupplierDefault = watch('saveAsSupplierDefault')
  const quantityNumber = Number(quantityStr) || 0

  // ---------------------------------------------------------------- the unit set (§2)
  // Supplier-scoped once a supplier is chosen, product-scoped before that. The distinction is
  // real and not cosmetic: "how this arrives" is a fact about the supplier at least as often as
  // about the product — the same rice comes from one mill in 50 kg bags and another in 25 kg
  // bags — so `ProductVendorResponse.unitOptions` (§2.3, step 3) carries that supplier's own pack
  // and this form must switch to it, or the supplier's normal pack would not be enterable at all.
  const selectedSupplier = productVendors.find((v) => v.companyVendorId === companyVendorId) ?? null
  const configuredUnitOptions = selectedSupplier
    ? unitOptionsForSupplier(product, selectedSupplier, unitOfMeasureOptions)
    : unitOptionsForProduct(product, unitOfMeasureOptions)

  // §3.1's per-request extension. Built only from a COMPLETE pack (a container and a positive
  // size): `buildPackOption` returns null otherwise, and non-negotiable 1 means a half-typed pack
  // must not become a factor-less option in the toggle while the user is still typing it.
  const deliveryPackOption = packOverride
    ? buildPackOption(
        { packagingUnit: overridePackUnit, packagingSize: overridePackSize ? Number(overridePackSize) : null },
        stockUnitLabel(configuredUnitOptions),
        unitOfMeasureOptions,
      )
    : null
  const unitOptions = withDeliveryPack(configuredUnitOptions, deliveryPackOption)

  /**
   * §9.3's receiving default: **the pack**, `defaultUnitOption` — and this is now a decision, not
   * the only rule available.
   *
   * `UNIT_UX_CONTRACT.md` §9.3 made entry defaults direction-aware. `isDefault` still means what
   * §2.1 says it means (the product's own pack if it has one, else the stock unit); what changed
   * is that the caller picks which default applies, because direction decides it. Receiving keeps
   * the pack — deliveries arrive in bags and an invoice counts bags — while `StockOutModal`
   * switched to `stockUnitOption`, since you buy a bag and sell 5 kg out of it. Same set, same
   * wire, one line different at each call site; §9.3 explicitly forbids expressing this as a
   * second flag on `UnitOption`.
   */
  const selectedOption =
    (unitCode == null ? undefined : unitOptions.find((option) => option.code === unitCode)) ?? defaultUnitOption(unitOptions)
  const stockUnitText = stockUnitLabel(unitOptions)

  /**
   * What the unit control actually offers: the product's own ways of counting (its stock unit and
   * its packs), not the whole set.
   *
   * A user reported the four-entry control on a millimetre product — "mm · or Dozen of 12 mm · or
   * cm · or m" — as confusing, and they were right: two of those are how the product is bought and
   * sold, the other two are arithmetic. Their instinct was to remove the control entirely and hide
   * unit choice behind the disclosure, which would go too far the other way. Odoo puts the UoM
   * selector directly beside the quantity on a receipt line, NetSuite gives every adjustment line a
   * Units column, and Zoho pairs the unit with the quantity field — none of them hide it, because
   * a bare number whose unit is implied is the defect this whole remediation set out to remove.
   *
   * So the control stays and gets shorter. Step 4's same-category base units remain in
   * `unitOptions` — every conversion, every preview and the submitted value all still resolve
   * against the full set — they are simply not offered as the everyday answer. `UnitToggle`
   * already renders nothing at one option, so a product with no pack shows no control at all,
   * which is the "just say the default" case the user asked for.
   */
  const offeredUnits = productsOwnUnits(unitOptions)

  // A completed pack override is selected the moment it exists. The user has just said, in as
  // many words, that this delivery came in it; leaving the toggle on kg would make them state the
  // same fact twice, and leaving it on the OLD pack ("Bag of 50 kg") after they typed 25 would be
  // actively wrong. Keyed on the option's identity rather than on a boolean so that editing the
  // size from 25 to 20 re-asserts the selection instead of only the first keystroke doing so.
  const deliveryPackCode = deliveryPackOption?.code
  const deliveryPackFactor = deliveryPackOption?.factorToStockUnit
  useEffect(() => {
    if (deliveryPackCode == null) return
    setUnitCode(deliveryPackCode)
  }, [deliveryPackCode, deliveryPackFactor])

  // ---------------------------------------------------------------- conversions (§3.1, §3.2)
  const baseQuantity = toBaseQuantity(quantityNumber, selectedOption)
  /**
   * §3.1 rounds `quantity × factor` HALF_UP at scale 0, so a fractional entry made in the STOCK
   * UNIT is stored as a different number from the one typed — "0.5 kg" becomes 1 kg.
   *
   * That case only became reachable when §9.1 made these fields accept decimals; before that a
   * stock-unit entry was always whole and the conversion line could safely be gated on "is the
   * entry unit different from the stock unit". It is not safe now, and non-negotiable 3 does not
   * have an exemption for rounding that happens to be small.
   */
  const quantityRoundsWhenStored = quantityNumber > 0 && baseQuantity !== quantityNumber
  /** Never gated on "is this the product's own pack" — that gate WAS P1-2. Shown whenever the
   *  number typed and the number recorded are different things, which is exactly when the two of
   *  them need to appear together (non-negotiable 3). */
  const showConversion = quantityNumber > 0 && (!selectedOption.isStockUnit || quantityRoundsWhenStored)
  /** §3.1's round-to-zero refusal, said here rather than round-tripped as a 400. Reachable
   *  through the same-category base units — 1 g against a KG stock unit is a real entry that
   *  disappears when converted, and a silent 0 is a disappearing delivery. */
  const roundsToZero = quantityNumber > 0 && !convertsCleanly(quantityNumber, selectedOption)

  const unitPriceNumber = unitPriceStr ? Number(unitPriceStr) : null
  const basePriceNumber = unitPriceNumber == null ? null : toBasePrice(unitPriceNumber, selectedOption)
  /** True when the price field's own unit is not the stock unit, i.e. when a division is happening
   *  between what is typed and what is stored (§3.2). The two price echoes below are gated on it
   *  in opposite directions, which is what makes them mutually exclusive rather than contradictory. */
  const priceConverts = !selectedOption.isStockUnit

  /**
   * The pack a stock-unit price is restated in — `UNIT_UX_CONTRACT.md` §9.2's per-pack cost echo.
   *
   * <h3>Why there are two echoes and why they never both appear</h3>
   * This field is entered per the selected unit and stored per stock unit (§3.2), so the number
   * that needs checking depends on which way the toggle is set, and exactly one of these is ever
   * on screen:
   * <ul>
   *   <li><b>Counting in bags</b> (the receiving default, §9.3). The user types ₦80,000 against an
   *       invoice that says ₦80,000 a bag, and the ledger will hold ₦1,000/kg. The useful echo is
   *       the stored one — `formatPriceEcho(basePriceNumber, …)`, "= ₦1,000.00 / kg stored".
   *       §9.2's per-pack echo here would print "= ₦80,000.00 / bag" directly beneath a field
   *       reading 80,000 per bag, which checks nothing.</li>
   *   <li><b>Counting in kg.</b> Now the typed number IS the stored one, so the stored echo is the
   *       tautology and §9.2's is the check: *"an invoice reading ₦80,000 a bag has to be divided
   *       by 80 before it is typed"* — the mental arithmetic the contract says must never be left
   *       to the reader. "= ₦80,000.00 / bag" is the line that catches a misplaced factor of
   *       eighty in the same glance as the number that caused it.</li>
   * </ul>
   * `AddPriceTierModal` resolves the identical question the identical way; the two price entry
   * points behave the same because they are the same problem.
   *
   * The pack preferred is THIS delivery's when one has been declared, not the product's standing
   * one — the override is the pack the invoice in the user's hand is written in, and echoing the
   * old 50 kg bag while they have just said 25 would restate the wrong fact. `formatPackCostEcho`
   * returns null for no pack, a pack that is the stock unit, an unusable factor and any price ≤ 0
   * (blank fields included), so nothing here needs a `> 0 &&` guard.
   */
  const packForCostEcho = deliveryPackOption ?? unitOptions.find((option) => option.isPack) ?? null
  const packCostEcho = priceConverts ? null : formatPackCostEcho(basePriceNumber, packForCostEcho)

  const vendorIsNewToProduct = companyVendorId.length > 0 && !productVendors.some((v) => v.companyVendorId === companyVendorId)

  function vendorLabel(id: string): string {
    return (
      productVendors.find((v) => v.companyVendorId === id)?.companyVendorName ??
      directoryVendors.find((v) => v.id === id)?.name ??
      ''
    )
  }

  const confirmVendorName = companyVendorId ? vendorLabel(companyVendorId) : ''

  // Client-side preview of design spec §5.1a's cheaper-supplier hint — computed live as quantity
  // or supplier changes, rather than only after the response comes back. `baseQuantity` is now
  // genuinely in base units (it used to be whatever `stockUnitMath` passed through), which is
  // what makes the `minQuantity` test correct at all: `minQuantity` has always been per stock
  // unit (multi-vendor §5.1a) and was being compared against an entered quantity in bags. The
  // response's own `cheaperVendorHint` (shown on the receipt step) remains authoritative.
  let cheaperPreview: { vendorName: string; savings: number } | null = null
  if (selectedSupplier && baseQuantity > 0) {
    const selectedPrice = resolvedVendorPrice(selectedSupplier, baseQuantity)
    if (selectedPrice != null) {
      for (const other of activeProductVendors) {
        if (other.companyVendorId === companyVendorId) continue
        const otherPrice = resolvedVendorPrice(other, baseQuantity)
        if (otherPrice != null && otherPrice < selectedPrice && (!cheaperPreview || otherPrice < selectedPrice - cheaperPreview.savings)) {
          cheaperPreview = { vendorName: other.companyVendorName, savings: selectedPrice - otherPrice }
        }
      }
    }
  }

  /** Withdrawing the pack disclosure clears the pack with it. Leaving the typed values behind
   *  would send a pack the user can no longer see — the same "a hidden field is still in the
   *  request" shape as P0-5, and the reason the opt-in checkbox is cleared here too. */
  function togglePackOverride() {
    setPackOverride((open) => {
      if (open) {
        setValue('packagingUnit', '')
        setValue('packagingSize', '')
        setValue('saveAsSupplierDefault', false)
      }
      return !open
    })
  }

  function goToConfirm() {
    if (roundsToZero) return
    setStep('confirm')
  }

  async function submit() {
    setSubmitError(null)
    setSubmitting(true)
    const values = getValues()
    const hasDeliveryPack = packOverride && deliveryPackOption != null
    const payload: StockInRequestPayload = {
      quantity: quantityNumber,
      // The stock unit's own code is a member of the set now (§2.1 step 1), so this is a real
      // code rather than the old "'' means base unit" convention. `''` survives only for the
      // product with no stock unit at all, where omitting `unit` is what the server expects.
      unit: selectedOption.code || undefined,
      // §3.2: sent per `unit`, exactly as typed and labelled. The server divides by the same
      // factor it multiplies the quantity by. Converting here as well would halve the price.
      unitPrice: values.unitPrice ? Number(values.unitPrice) : undefined,
      companyVendorId: values.companyVendorId || undefined,
      packagingUnit: hasDeliveryPack ? values.packagingUnit : undefined,
      packagingSize: hasDeliveryPack ? Number(values.packagingSize) : undefined,
      // Absent means false and false means "touch nothing" (§3.4) — so this is only ever sent as
      // `true`, and only when there is a pack for it to be about.
      saveAsSupplierDefault: hasDeliveryPack && values.saveAsSupplierDefault ? true : undefined,
      note: values.note || undefined,
    }
    try {
      const res = await stockApi.stockIn(product.id, payload)
      setResult(res)
      setStep('receipt')
    } catch (err) {
      setSubmitError(isAppError(err) ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * "20 bags (1,000 kg)" — non-negotiable 3, on every surface that states this entry: the live
   * line under the field, the confirm sentence and the receipt all read from this one string, so
   * there is no path on which they can disagree.
   *
   * `formatEnteredAndBase` collapses to a single figure when the entry unit IS the stock unit,
   * because "1,000 kg (1,000 kg)" is noise rather than a second fact. `quantityRoundsWhenStored`
   * is the one case where that is no longer true — see its note — so the pair is composed here
   * instead, in the same shape and from the same `formatQuantity` helper, with the parenthetical
   * saying which of the two the ledger keeps.
   */
  const quantityBothWays =
    formatEnteredAndBase(quantityNumber, selectedOption, baseQuantity, stockUnitText)
  /** "₦45,000.00 / bag (₦900.00 / kg)" — the same rule applied to the price (§7.2). */
  const priceBothWays =
    unitPriceNumber == null
      ? null
      : selectedOption.isStockUnit
        ? formatPricePer(unitPriceNumber, stockUnitText)
        : `${formatPricePerOption(unitPriceNumber, selectedOption)} (${formatPricePer(basePriceNumber, stockUnitText)})`

  const overridePackLabel = overridePackUnit
    ? (resolveUnitLabel(overridePackUnit, unitOfMeasureOptions) ?? overridePackUnit)
    : null
  const overridePackHint = unitsPerPackHint(overridePackSize ? Number(overridePackSize) : null, stockUnitText, overridePackLabel)
  const supplierForDefault = confirmVendorName || null

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={step === 'form' ? 'Stock in' : step === 'confirm' ? 'Confirm stock in' : 'Stock in recorded'}
      footer={
        step === 'form' ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit(goToConfirm)} disabled={productVendorsLoading || roundsToZero}>
              Continue
            </Button>
          </>
        ) : step === 'confirm' ? (
          <>
            <Button variant="secondary" onClick={() => setStep('form')} disabled={submitting}>
              Edit
            </Button>
            <Button onClick={() => void submit()} loading={submitting}>
              Confirm
            </Button>
          </>
        ) : (
          <Button onClick={() => result && onSuccess(result)}>Done</Button>
        )
      }
    >
      {step === 'form' && (
        <form onSubmit={handleSubmit(goToConfirm)} noValidate className="flex flex-col gap-4">
          {/* Quantity and its unit are ONE question — "how much, of what" — so they sit on one
              row with the toggle glued to the input, the way Odoo 18 and Zoho Inventory both
              render a quantity. They stack at 360px rather than shrinking, because a unit label
              squeezed to "Bag o…" is worse than one on its own line. The hint states every valid
              answer on the row that asks the question (`howYouCountIt`) — the reported complaint
              was exactly a question asked without its answers in sight. */}
          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-2">
              <div className="flex-1">
                <TextField
                  label="Quantity"
                  // `decimal`, not `numeric`: §9.1 accepts decimals on a count of packs ("thirty
                  // kegs and a half-full one is a real shelf") and a phone keypad with no decimal
                  // point cannot type one.
                  inputMode="decimal"
                  hint={
                    // Only when there is no control to read the unit off. With the toggle on
                    // screen the hint just restates it, and restating a control next to the
                    // control is the noise a user reported as confusing.
                    //
                    // Built from `offeredUnits`, not the whole set: the set also carries §2.1
                    // step 4's same-category base units, and naming "mm · or cm · or m" beside a
                    // field whose control is not on screen offers answers nothing here is asking
                    // for — the mirror image of non-negotiable 4's "no question whose valid
                    // answers it does not show".
                    offeredUnits.length > 1 ? undefined : `${UNIT_COPY.COUNTED_IN} ${howYouCountIt(offeredUnits)}`
                  }
                  error={errors.quantity?.message}
                  {...register('quantity')}
                />
              </div>
              <div className="sm:pb-0.5">
                <UnitToggle
                  value={selectedOption.code}
                  onChange={setUnitCode}
                  options={offeredUnits}
                  label={UNIT_COPY.COUNTED_IN}
                />
              </div>
            </div>
            {/* Both numbers, live, on the path that used to go dark (P1-2). */}
            {showConversion && !roundsToZero && <p className="mt-1.5 text-xs text-neutral-500">{quantityBothWays}</p>}
            {roundsToZero && (
              <p role="alert" className="mt-1.5 text-xs text-danger-600">
                {roundsToZeroMessage(quantityNumber, selectedOption, stockUnitText)}
              </p>
            )}
          </div>

          {vendorFieldVisible && (
            <div>
              <label htmlFor="stock-in-supplier" className="mb-1.5 block text-sm font-medium text-neutral-700">
                {UNIT_COPY.SUPPLIER}
                {supplierOverride && (
                  <span className="font-normal text-neutral-400">
                    {' '}
                    (any {UNIT_COPY.SUPPLIER.toLowerCase()} in your directory, not just this product&apos;s)
                  </span>
                )}
              </label>
              {productVendorsLoading ? (
                <p className="text-sm text-neutral-500">Loading {UNIT_COPY.SUPPLIERS.toLowerCase()}…</p>
              ) : vendorOptions.length === 0 ? (
                <p className="text-sm text-neutral-500">No {UNIT_COPY.SUPPLIERS.toLowerCase()} in your directory yet.</p>
              ) : (
                <select
                  id="stock-in-supplier"
                  className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                  {...register('companyVendorId')}
                >
                  <option value="">Choose a {UNIT_COPY.SUPPLIER.toLowerCase()}</option>
                  {vendorOptions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              )}
              {errors.companyVendorId?.message && <p className="mt-1.5 text-xs text-danger-600">{errors.companyVendorId.message}</p>}
            </div>
          )}

          {/* Named action 1. Only offered when there is somewhere else to go: with no directory
              (or no permission to read it) this would reveal an empty select, which reads as
              broken rather than as "nothing to choose". */}
          {!supplierOverride && canViewVendors && activeDirectoryVendors.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setSupplierOverride(true)}
                className="flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <Truck className="h-4 w-4" aria-hidden="true" />
                Use a different {UNIT_COPY.SUPPLIER.toLowerCase()}
              </button>
            </div>
          )}

          {/* Named action 2 — plan §6.2. Says what it reveals, and what it reveals is one idea
              (a Pack) plus one explicit decision about it, not four unrelated controls.

              Offered only once the product has a stock unit. §2.1's single-entry set is the
              pre-V17 product that never got one, and a pack for it would be "Bag of 25 units" —
              25 of nothing. `unitSet.buildUnitOptions` refuses to build a pack option in that
              case for exactly this reason ("a pack of 50 with nothing to be 50 OF is not a
              conversion"), so offering the control would reveal two fields that cannot produce a
              usable option. The way out is to give the product a stock unit on the product form,
              which is where that decision belongs. */}
          {product.unitOfMeasure && (
            <>
              <div>
                <button
                  type="button"
                  onClick={togglePackOverride}
                  aria-expanded={packOverride}
                  aria-controls="stock-in-delivery-pack"
                  className="flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  {packOverride ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                  <Package className="h-4 w-4" aria-hidden="true" />
                  This delivery came in a different pack
                </button>
              </div>

              {packOverride && (
                <div id="stock-in-delivery-pack" className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                  {/* One idea, one row, stacking at 360px — the same layout the product form uses
                      for the same pair, because §1 makes them a single phrase ("Bag of 25 kg")
                      and a reader must never have to join a noun and a bare number themselves. */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="stock-in-delivery-pack-unit" className="mb-1.5 block text-sm font-medium text-neutral-700">
                        {UNIT_COPY.PACK}
                      </label>
                      <select
                        id="stock-in-delivery-pack-unit"
                        className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                        {...register('packagingUnit')}
                      >
                        <option value="">Choose what it arrived in</option>
                        {packagingOptions.map((o) => (
                          <option key={o.code} value={o.code}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {errors.packagingUnit?.message && <p className="mt-1.5 text-xs text-danger-600">{errors.packagingUnit.message}</p>}
                    </div>
                    <TextField
                      label={UNIT_COPY.UNITS_PER_PACK}
                      inputMode="decimal"
                      hint={overridePackHint ?? `How many ${stockUnitText} came in one of them`}
                      error={errors.packagingSize?.message}
                      {...register('packagingSize')}
                    />
                  </div>

                  {/* The pack is now in the toggle, so the user can see the option they just
                      created and the conversion that follows from it. Tinted primary-50 because
                      it is a RESULT, not a hint — and the sentence says everything on its own for
                      anyone who cannot see the tint. */}
                  {deliveryPackOption && (
                    <p className="rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-xs text-primary-900">
                      &ldquo;{deliveryPackOption.label}&rdquo; is now one of the units you can count this delivery in.
                    </p>
                  )}

                  {/* §3.4 / non-negotiable 7 — the opt-in, unchecked, on the same screen as the
                      override it governs. Disabled with the reason on screen when there is no
                      supplier for a default to belong to, rather than hidden: a checkbox that
                      appears and disappears as the supplier field changes is harder to trust
                      than one that stays put and explains itself. */}
                  <label className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      disabled={supplierForDefault == null}
                      className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                      {...register('saveAsSupplierDefault')}
                    />
                    <span>
                      <span className="block text-sm font-medium text-neutral-700">
                        {supplierForDefault
                          ? `Make this ${supplierForDefault}'s usual pack`
                          : `Make this the ${UNIT_COPY.SUPPLIER.toLowerCase()}'s usual pack`}
                      </span>
                      <span className="block text-xs text-neutral-500">
                        {supplierForDefault == null
                          ? `Choose a ${UNIT_COPY.SUPPLIER.toLowerCase()} first.`
                          : saveAsSupplierDefault
                            ? `Every future delivery from ${supplierForDefault} will start in this pack.`
                            : `Left unticked, this pack applies to this delivery only — ${supplierForDefault}'s usual pack stays exactly as it is.`}
                      </span>
                    </span>
                  </label>
                </div>
              )}
            </>
          )}

          {/* PLACEMENT — the price comes after the pack, not before it.
              §7.2 says no price field is labelled without naming what it is per, and this field
              names its basis from the "Counted in" control ("₦ per bag"). That is only honest if
              the basis is settled before the number is typed: declaring a 25 kg bag half-way down
              the form silently re-points a price already entered against the usual 50 kg one — the
              noun in the label does not even change, only the factor behind it. So the two named
              overrides that can move the basis (the supplier, whose own pack re-scopes the unit
              set per §2.3, and this delivery's pack per §3.1) are both resolved above, and the
              price is asked last. The cheaper-supplier hint stays glued to it, since it is a
              statement about the number just typed. */}
          <div>
            {/* §7.2 / P0-1: the unit is part of the price field's own label, never inferred from a
                neighbouring field. "Unit price" alone is the ambiguity; "₦ per bag" is not. The
                same label shape the product form and the price-break form use, because they are
                the same question asked in three places. */}
            <TextField
              label={`Unit price (₦ per ${unitNoun(selectedOption)})`}
              inputMode="decimal"
              hint="Optional"
              error={errors.unitPrice?.message}
              {...register('unitPrice')}
            />
            {/* ÷ factor — what the ledger will hold (§3.2). "stored" is said out loud rather than
                left to the reader to infer from an equals sign. */}
            {priceConverts && basePriceNumber != null && unitPriceNumber != null && unitPriceNumber > 0 && (
              <p className="mt-1.5 text-xs text-neutral-500">{formatPriceEcho(basePriceNumber, stockUnitText)} stored</p>
            )}
            {/* × factor, the other direction — §9.2's per-pack echo, for a price typed in the
                stock unit beside a product that comes in a pack. See `packCostEcho`: never on
                screen at the same time as the line above. */}
            {packCostEcho && <p className="mt-1.5 text-xs text-neutral-500">{packCostEcho}</p>}
            {/* Always, not only when a conversion is happening. With two echoes possible the
                question "which of these numbers is the one that gets saved?" is live in both
                directions, and §9.2's whole justification for anchoring cost to the stock unit —
                suppliers with different pack sizes stay comparable — is the answer. */}
            <p className="mt-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
              {priceBasisNote(stockUnitText)}
            </p>
          </div>

          {cheaperPreview && (
            <p className="text-sm text-primary-700">
              {cheaperPreview.vendorName} is {formatPricePer(cheaperPreview.savings, stockUnitText)} cheaper at this quantity.
            </p>
          )}

          <div>
            <label htmlFor="stock-in-note" className="mb-1.5 block text-sm font-medium text-neutral-700">
              Note
            </label>
            <textarea
              id="stock-in-note"
              rows={2}
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
              {...register('note')}
            />
            {errors.note?.message && <p className="mt-1.5 text-xs text-danger-600">{errors.note.message}</p>}
          </div>
        </form>
      )}

      {/* §7.3's read-only summary, and non-negotiable 3's one hard rule: what the user typed and
          what the ledger will record appear TOGETHER, always, with no conditional able to hide
          the conversion. "Adding 20 bags (1,000 kg) of Rice 50kg from Dangote Nigeria Plc at
          ₦45,000.00 / bag (₦900.00 / kg)." */}
      {step === 'confirm' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <p className="text-sm text-neutral-700">
              Adding <span className="font-semibold text-neutral-900">{quantityBothWays}</span> of{' '}
              <span className="font-semibold text-neutral-900">{product.name}</span>
              {confirmVendorName && (
                <>
                  {' '}
                  from <span className="font-semibold text-neutral-900">{confirmVendorName}</span>
                </>
              )}
              {priceBothWays && (
                <>
                  {' '}
                  at <span className="font-semibold text-neutral-900">{priceBothWays}</span>
                </>
              )}
              .
            </p>
            {/* §9.2 on the surface where the invoice is actually being checked. Only ever renders
                on the branch `priceBothWays` cannot carry: a price entered in the stock unit has
                no parenthetical of its own, and the pack figure is the one the invoice states. */}
            {packCostEcho && <p className="mt-2 text-sm text-neutral-600">{packCostEcho}</p>}
            {/* The override, and what it will and will not change — stated before the request,
                not promised in help text the request then contradicts (P0-5). */}
            {deliveryPackOption && (
              <p className="mt-2 text-sm text-neutral-600">
                This delivery came in {deliveryPackOption.label}.{' '}
                {supplierForDefault == null
                  ? 'It applies to this delivery only.'
                  : saveAsSupplierDefault
                    ? `It will also become ${supplierForDefault}'s usual pack.`
                    : `${supplierForDefault}'s usual pack stays unchanged.`}
              </p>
            )}
            {/* §7.3: this line only renders when true — omitted entirely otherwise, never shown
                as an empty or "as usual" placeholder. */}
            {vendorIsNewToProduct && confirmVendorName && (
              <p className="mt-2 text-sm text-neutral-600">{confirmVendorName} is new to this product.</p>
            )}
            {cheaperPreview && (
              <p className="mt-2 text-sm text-primary-700">
                {cheaperPreview.vendorName} is {formatPricePer(cheaperPreview.savings, stockUnitText)} cheaper at this quantity.
              </p>
            )}
          </div>
          <FormError message={submitError} />
        </div>
      )}

      {step === 'receipt' && result && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-accent-200 bg-accent-50 p-4">
            <p className="text-sm font-semibold text-accent-800">Recorded</p>
            <p className="mt-1 text-sm text-accent-700">
              {quantityBothWays} of {product.name} added
              {confirmVendorName && ` from ${confirmVendorName}`}.
            </p>
          </div>
          <dl className="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-neutral-500">New {UNIT_COPY.ON_HAND.toLowerCase()}</dt>
              {/* Base units, and said so — plan §3's P2 was this exact figure rendered bare. */}
              <dd className="mt-0.5 font-medium text-neutral-900">{formatQuantity(result.product.quantityOnHand, stockUnitText)}</dd>
            </div>
            {result.vendorIsNewToProduct && confirmVendorName && (
              <div className="sm:col-span-2">
                <dt className="text-neutral-500">{UNIT_COPY.SUPPLIER}</dt>
                <dd className="mt-0.5 text-neutral-700">{confirmVendorName} is now linked to this product.</dd>
              </div>
            )}
            {result.cheaperVendorHint && (
              <div className="sm:col-span-2">
                <dt className="text-neutral-500">Worth knowing</dt>
                <dd className="mt-0.5 text-primary-700">
                  {/* `savingsPerUnit` is per stock unit (§3.2) and now says so. */}
                  {result.cheaperVendorHint.companyVendorName} is{' '}
                  {formatPricePer(result.cheaperVendorHint.savingsPerUnit, stockUnitText)} cheaper at this quantity.
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </Modal>
  )
}
