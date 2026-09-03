import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, Clock, Lock, Ruler, Tag, Truck, Zap } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { TextField } from '@/components/TextField'
import { useToast } from '@/components/useToast'
import { productsApi } from '@/features/products/api/productsApi'
import { ImageUploadField } from '@/features/products/components/ImageUploadField'
import { ProductFormSkeleton } from '@/features/products/components/ProductFormSkeleton'
import { RequestUnitOfMeasureModal } from '@/features/products/components/RequestUnitOfMeasureModal'
import { ReviewImpactDialog } from '@/features/products/components/ReviewImpactDialog'
import { ReviewImpactNotice } from '@/features/products/components/ReviewImpactNotice'
import { useProduct } from '@/features/products/hooks/useProduct'
import { useStockHistory } from '@/features/products/hooks/useStockHistory'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import {
  productFormDefaults,
  productFormSchema,
  toInitialVendorPayload,
  toProductPayload,
  toProductUpdatePayload,
  toVendorMarketplaceDetailsPayload,
  type ProductFormValues,
} from '@/features/products/schemas'
import type { Product, UnitOfMeasureCategory, UnitOption } from '@/features/products/types'
import {
  UNIT_COPY,
  fieldLabelInUnit,
  formatPackCostEcho,
  formatStockUnitCostEcho,
  formatQuantityEcho,
  packSummarySentence,
  pluraliseUnitNoun,
  roundsToZeroMessage,
  unitNoun,
  unitsPerPackHint,
} from '@/features/products/unitCopy'
import {
  convertsCleanly,
  defaultUnitOption,
  fromBaseQuantity,
  resolveUnitSymbol,
  toBaseQuantity,
  unitOptionsForProduct,
} from '@/features/products/unitSet'
import { vendorCatalogueApi } from '@/features/vendor/api/vendorCatalogueApi'
import { useVendorOptions } from '@/features/vendors/hooks/useVendorOptions'
import { isAppError } from '@/types/api'

const KNOWN_FIELDS = new Set<keyof ProductFormValues>([
  'name',
  'sku',
  'description',
  'unitPrice',
  'unitOfMeasure',
  'packagingUnit',
  'packagingSize',
  'lowStockThreshold',
  'initialVendorId',
  'initialVendorCost',
  'initialVendorQuantity',
])

// Fixed display order for the "Stock unit" picker's <optgroup>s — independent of whatever
// order the server happens to return its rows in, so the groups don't shuffle between a create
// and an edit. WEIGHT/VOLUME/LENGTH group real entries; COUNT holds exactly one entry ("Piece"),
// since every other COUNT code is role: PACKAGING and lives in the second picker instead. A
// single-item "Count" optgroup was judged not worth a special case — it costs nothing to render
// and keeps the grouping logic uniform across all four categories.
const CATEGORY_ORDER: UnitOfMeasureCategory[] = ['COUNT', 'WEIGHT', 'VOLUME', 'LENGTH']
const CATEGORY_LABELS: Record<UnitOfMeasureCategory, string> = {
  COUNT: 'Count',
  WEIGHT: 'Weight',
  VOLUME: 'Volume',
  LENGTH: 'Length',
}

/**
 * The message client-side for the same rule the server's `UnitPriceRequiredException`
 * enforces, so a vendor who left this blank sees an attributed field error before the request
 * rather than a 400 with no field to attach it to (that exception comes back as a plain
 * `{message}`, not a per-field error — see `save`'s catch block).
 */
const UNIT_PRICE_REQUIRED_MESSAGE = "Unit price is required for a marketplace seller's product."

/**
 * The identity fields this form can write, paired with the label the vendor sees.
 *
 * The server's rule now covers eight (`ProductModerationRules.invalidatesApproval`): the five
 * below plus the photo (compared by intent, not listed here), `packagingUnit` and
 * `packagingSize`, added alongside `unitOfMeasure` because a 25kg bag silently becoming 50kg is
 * exactly the kind of identity change this dialog exists to warn about. Brand is set through the
 * seller's marketplace-details route (a SECOND request from the same save, see `saveBrand`);
 * unit of measure and the packaging pair are NOT — they go to `/api/products` in the SAME
 * request as everything else now, for every tenant, not just a vendor.
 *
 * <p>The labels are the ones on the inputs below, because `ReviewImpactDialog` reads them back
 * to the vendor at the point of no return — a dialog naming a field they cannot find on the
 * form is worse than no dialog.
 */
// `keyof ProductFormValues & keyof Product`, not just `keyof ProductFormValues`: this array is
// diffed against a real `Product` in `changedIdentityLabels` below (`product[field]`), and since
// the "First supplier" fields (`initialVendorId` etc.) exist only on the form's values — there
// is no such thing as an existing product's first supplier to diff against — a wider type here
// would let one sneak into this list and fail to compile at the one place it's actually read.
const IDENTITY_FIELDS: { field: keyof ProductFormValues & keyof Product; label: string }[] = [
  { field: 'name', label: 'Product name' },
  { field: 'sku', label: 'SKU' },
  { field: 'description', label: 'Description' },
  { field: 'brand', label: 'Brand' },
  // §1's locked names, imported rather than retyped — `ReviewImpactDialog` reads these back to a
  // seller at the point of no return, and a dialog naming a field they cannot find on the form is
  // worse than no dialog. They were "Measured in" / "Packaged as" / "Pack size", three of the four
  // vocabularies `UNIT_UX_REMEDIATION_PLAN.md` §2 counted.
  { field: 'unitOfMeasure', label: UNIT_COPY.STOCK_UNIT },
  { field: 'packagingUnit', label: UNIT_COPY.PACK },
  { field: 'packagingSize', label: UNIT_COPY.UNITS_PER_PACK },
]

/**
 * Create and edit a product — `/app/products/new` and `/app/products/:id/edit`.
 *
 * <h2>The form is split into two groups, and the split is the message</h2>
 * A vendor editing a listing has no way of knowing, from the fields alone, that renaming it
 * takes it off the storefront while re-pricing it does not. The rule was documented on the
 * server and invisible here, and the reported failure is exactly what that produces: a vendor
 * changes a name, sees nothing unusual, and finds the next morning that buyers cannot find
 * the product.
 *
 * So the consequence is surfaced three times, in decreasing distance from the mistake:
 * <ol>
 *   <li><b>Before typing</b> — {@link ReviewImpactNotice} enumerates both groups of fields by
 *       name, so nothing has to be inferred.</li>
 *   <li><b>While typing</b> — the fields are laid out in two labelled sections, so the group
 *       a field belongs to is visible at the moment it is edited rather than recalled.</li>
 *   <li><b>At the point of no return</b> — {@link ReviewImpactDialog} confirms, naming the
 *       fields that ACTUALLY changed. It appears only when one really did, so a price edit
 *       still saves in one click and the dialog does not get trained away.</li>
 * </ol>
 * And once more after the fact, in the success toast, because the listing has visibly
 * changed state and a silent success would leave that unexplained.
 *
 * <h2>The review-consequence framing is vendor-only; the section structure is not</h2>
 * Every tenant sees the form broken into labelled sections (Basic details, How you count and
 * pack this product, Pricing, First supplier, Stock alerts) — a flat, undifferentiated field list is confusing
 * regardless of whether re-review is a concept that applies to you. What's gated on `isVendor`
 * (mirroring the server's own condition: `ProductModerationRules.isModerated` is true for a
 * seller that is not the platform owner) is only the REVIEW-SPECIFIC copy layered onto the
 * "Basic details" and "Pricing" sections — {@link ReviewImpactNotice}, the Clock/warning-600
 * "sends the listing back for review" framing, and the Pricing section itself (it has nothing
 * left in it for a non-vendor once cost price is gone, see below). ProcurePal's own products are
 * stamped APPROVED at write time and a buying company's private stock list is never moderated at
 * all — telling either of them their napkin count is going for review would be a false statement
 * about a queue they will never enter.
 *
 * <h2>The field order is load-bearing — `UNIT_UX_CONTRACT.md` §9</h2>
 * Under §9.1 the two catalog quantities — {@link UNIT_COPY.OPENING_STOCK} and
 * {@link UNIT_COPY.LOW_STOCK_ALERT_AT} — count **packs whenever the row declares one**, and stock
 * units when it does not. A number on this form therefore has no meaning until the pack is known,
 * which is why the counting group (Stock unit → Pack → Units per pack) now comes before every
 * quantity and every price on the page, and why both quantity fields restate their unit in the
 * label and echo the stock-unit equivalent underneath as they are typed.
 *
 * The reason that echo exists is a report, not a preference: a user filled in the opening
 * quantity meaning twelve 40 kg bags and got 12 kg. Nothing on screen was wrong, and nothing on
 * screen said which of the two it was going to be.
 *
 * Cost runs the OTHER way (§9.2): it stays anchored to the stock unit — ₦ per kg, never ₦ per bag
 * — because that is the only figure comparable across suppliers whose packs differ. §9.2 names
 * the cost of that choice (an invoice reading "₦80,000 a bag" has to be divided by 80 before it
 * is typed) and pays it down with a live per-pack echo, `unitCopy.formatPackCostEcho`.
 *
 * <h2>No standalone "Cost price" field</h2>
 * In every mainstream system with vendor-based costing (Odoo's AVCO, NetSuite's Average Cost),
 * a product's cost is a computed rollup from actual purchases, never a value typed alongside a
 * separate per-vendor purchase price for the same transaction. This app's backend already works
 * that way — `Product.costPrice` is a weighted average recalculated on every stock-in (see
 * MULTI_VENDOR_INVENTORY_DESIGN.md §5.3) — so this form never collects it directly. The only
 * place a cost is typed is the "First supplier" block's own `initialVendorCost`, for that first
 * purchase; everywhere else, cost is something to look at (the detail page's Overview tab), not
 * something to edit here.
 */
export function ProductFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  // The only thing a caller ever hands this page via router state: the name someone typed into
  // the "Add a product" search (see NewProductSearchModal) before landing here having chosen
  // "Create new product". Absent on every other way of reaching this route (a bookmark, the
  // edit link, a browser refresh), so it is read once, on the very first render, and never
  // fought with afterwards.
  const location = useLocation() as { state?: { name?: string } }
  const { showToast } = useToast()
  const { user, isVendor } = useAuth()
  const { product, loading: loadingProduct } = useProduct(id)
  // Gated on VIEW_VENDORS rather than fetched unconditionally: the picker is optional, and asking
  // for a list the caller is not allowed to read would be a 403 in everyone's network tab.
  const canViewVendors = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.VIEW_VENDORS)
  const { vendors: vendorOptions } = useVendorOptions(canViewVendors)
  // `options` (the whole fetched list) as well as the two role-filtered slices: §9.1's quantity
  // fields are counted in the product's PACK, and building that pack as a `UnitOption` needs to
  // resolve a PACKAGING-role code against the same list the stock unit is resolved against.
  const { options: unitOfMeasureOptions, baseOptions, packagingOptions } = useUnitOfMeasureOptions()
  const [formError, setFormError] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [showUnitRequestModal, setShowUnitRequestModal] = useState(false)
  /** Held while the confirmation is open, so confirming submits exactly what was validated. */
  const [pendingValues, setPendingValues] = useState<ProductFormValues | null>(null)
  const [changedIdentityFields, setChangedIdentityFields] = useState<string[]>([])

  // "Stock unit" picker — BASE-role codes only, grouped by category.
  const baseUnitsByCategory = CATEGORY_ORDER.map((category) => ({
    category,
    options: baseOptions.filter((option) => option.category === category),
  })).filter((group) => group.options.length > 0)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    // Prefilled with the name typed into the search-first "Add a product" flow, on create only —
    // an edit always starts from the product below instead. `location.state` is read once here
    // because `defaultValues` is only consulted on the form's first render; nothing re-reads it
    // after that, which is fine, since nothing navigates within this page without unmounting it.
    defaultValues: isEdit ? productFormDefaults() : { ...productFormDefaults(), name: location.state?.name ?? '' },
  })

  /**
   * Which product this form has already been filled from.
   *
   * The reset below now reads `unitOfMeasureOptions` as well as `product`, because §9.1's
   * low-stock figure arrives from the server in STOCK UNITS and has to be divided back into
   * packs before it can go into a field that now counts packs. Two inputs means the effect can
   * fire twice — once before the unit list has landed, once after — and a second `reset()` would
   * silently discard whatever the user had typed in between. So it runs once per product id.
   *
   * The single run is safe even when it happens before the list arrives: a pack's conversion
   * factor IS `packagingSize` (contract §2.1 step 2), carried on the product itself. The fetched
   * list only supplies the pack's LABEL, which nothing here reads.
   */
  const filledFromProductId = useRef<string | null>(null)

  useEffect(() => {
    if (!product) return
    if (filledFromProductId.current === product.id) return
    filledFromProductId.current = product.id

    // §9.1: `low_stock_alert_at` counts packs whenever the row declares one. Storage did not
    // change — the server still holds it in stock units — so an edit divides on the way in and
    // `save` multiplies on the way back out. `defaultUnitOption` is the pack when there is one
    // and the stock unit otherwise (§2.1), which is exactly §9.1's "whenever the row declares
    // one"; with no pack the factor is 1 and this is the identity it always was.
    const savedEntryOption = defaultUnitOption(unitOptionsForProduct(product, unitOfMeasureOptions))
    const savedLowStock =
      product.lowStockThreshold != null ? fromBaseQuantity(product.lowStockThreshold, savedEntryOption) : null

    reset({
      name: product.name,
      sku: product.sku,
      description: product.description ?? '',
      brand: product.brand ?? '',
      unitOfMeasure: product.unitOfMeasure ?? '',
      packagingUnit: product.packagingUnit ?? '',
      packagingSize: product.packagingSize != null ? String(product.packagingSize) : '',
      unitPrice: product.unitPrice != null ? String(product.unitPrice) : '',
      lowStockThreshold: savedLowStock != null ? String(savedLowStock) : '',
      // The "First supplier" block only ever applies at creation — an existing product's
      // suppliers live on the Suppliers tab, not here — so an edit always resets these to blank.
      initialVendorId: '',
      initialVendorCost: '',
      initialVendorQuantity: '',
    })
  }, [product, reset, unitOfMeasureOptions])

  /**
   * Live values for the pack group's self-explaining copy. Read through `watch` rather than
   * `getValues` so the "50 kg per bag" suffix and the summary sentence update as the selects
   * change — plan §6.1's whole point is that the relationship between these three fields is
   * stated while it is being configured, not recalled later at the point of entry.
   */
  const watchedStockUnitCode = watch('unitOfMeasure')
  const watchedPackCode = watch('packagingUnit')
  const watchedUnitsPerPack = watch('packagingSize')

  // `resolveUnitSymbol` turns "KG" into "kg" — the short form these sentences repeat several
  // times over, per contract §2.1 step 1, taken from the server's own `symbol` field. Null (not
  // "units") when nothing is chosen yet, so the copy below can stay silent rather than assert
  // something about a unit that isn't set.
  const stockUnitLabel = watchedStockUnitCode ? resolveUnitSymbol(watchedStockUnitCode, baseOptions) : null
  const packLabel = watchedPackCode
    ? (packagingOptions.find((option) => option.code === watchedPackCode)?.label ?? watchedPackCode)
    : null
  const unitsPerPackNumber = watchedUnitsPerPack ? Number(watchedUnitsPerPack) : null
  const packHint = unitsPerPackHint(unitsPerPackNumber, stockUnitLabel, packLabel)
  const packSummary = packSummarySentence(packLabel, unitsPerPackNumber, stockUnitLabel)

  /**
   * The unit every quantity on this form is counted in — `UNIT_UX_CONTRACT.md` §9.1.
   *
   * This is the amendment's whole substance on this screen. `opening_stock` and
   * `low_stock_alert_at` count **packs whenever the row declares one, and stock units when it
   * does not**; no field asks which, because the three fields above already answered it. Built
   * from the LIVE form values rather than from the saved product, so choosing Bag/50 re-labels
   * both quantity fields the moment it is chosen, on a create where there is no saved product to
   * read at all.
   *
   * §9.3's receiving default, in one line: `defaultUnitOption` is the pack when there is one
   * (`isDefault`, §2.1), else the stock unit — and catalog opening stock sits on the receiving
   * side of that split, with deliveries and invoices, not the issuing side. `null` until a stock
   * unit is chosen: before then a quantity has no unit to be in and the fields say nothing rather
   * than guessing "units".
   *
   * <h2>Decimals</h2>
   * §9.1 is explicit that **both** these quantities accept them: "thirty kegs and a half-full one
   * is a real shelf, and an integer count of packs cannot say it." `inputMode` is decimal on both
   * fields, `toStockUnits` rounds at §3.1's HALF_UP scale 0 on the way out, and `productFormSchema`
   * now refines `lowStockThreshold` / `initialVendorQuantity` as non-negative / positive NUMBERS
   * (the integer rules were closed by the stock-modal module, which owns `schemas.ts` per §0).
   * That also unblocked editing an existing product whose stored threshold does not divide evenly
   * by its pack — 1,010 kg against a 50 kg bag fills in here as "20.2", which the old integer rule
   * then refused to save back.
   */
  const quantityOption: UnitOption | null = watchedStockUnitCode
    ? defaultUnitOption(
        unitOptionsForProduct(
          {
            unitOfMeasure: watchedStockUnitCode,
            packagingUnit: watchedPackCode,
            packagingSize: unitsPerPackNumber,
          },
          unitOfMeasureOptions,
        ),
      )
    : null
  /** True when the quantity fields are counting packs, i.e. when a conversion is happening at all. */
  const countsInPacks = quantityOption != null && !quantityOption.isStockUnit
  /** The pack's noun ("basket") when this row counts in packs — §9.2's cost is per one of these. */
  const packNoun = countsInPacks && quantityOption != null ? unitNoun(quantityOption) : null
  /** Whether the opening-stock field is on this render at all — it lives in the create-only,
   *  VIEW_VENDORS-gated "First supplier" block, so an edit has only the alert level to talk about. */
  const showOpeningStock = !isEdit && canViewVendors

  const watchedOpeningStock = watch('initialVendorQuantity')
  const watchedLowStock = watch('lowStockThreshold')
  const watchedInitialCost = watch('initialVendorCost')
  const watchedUnitPrice = watch('unitPrice')

  /**
   * "= 1,600 kg" under a field reading "32", in bags.
   *
   * Not decoration. This is the same number the ledger will hold, converted with the same helper
   * and the same HALF_UP scale-0 rounding the server rounds with (§3.1), so what is on screen is
   * what is stored (§7.3) rather than an approximation of it. It is only worth printing when a
   * conversion is actually happening — "= 12 kg" under a field already labelled kg is noise, and
   * §9.1's static hint covers the no-pack case instead.
   */
  function baseQuantityEcho(typed: string): string | null {
    if (!countsInPacks || quantityOption == null || stockUnitLabel == null) return null
    const value = Number(typed)
    if (!typed || !Number.isFinite(value) || value <= 0) return null
    if (!convertsCleanly(value, quantityOption)) return null
    return formatQuantityEcho(toBaseQuantity(value, quantityOption), stockUnitLabel)
  }

  /**
   * The hint under a §9.1 quantity field: the live conversion once there is a number, and what
   * the field is counted in before there is one.
   *
   * Carried in the field's `hint` rather than in a paragraph beside it so it is wired into
   * `aria-describedby` — a conversion a screen reader cannot reach is a conversion half the
   * readers cannot check.
   */
  function quantityHint(typed: string): string | undefined {
    const echo = baseQuantityEcho(typed)
    if (echo) return echo
    if (quantityOption == null) return undefined
    if (!countsInPacks) return `${UNIT_COPY.COUNTED_IN} ${quantityOption.label}.`
    // "Counted in bags — 50 kg per bag." The second half is `unitsPerPackHint`'s own sentence,
    // reused rather than rebuilt, so the pack's arithmetic is stated one way in this whole form.
    const perPack = packHint ? ` — ${packHint}` : ''
    return `${UNIT_COPY.COUNTED_IN} ${pluraliseUnitNoun(unitNoun(quantityOption), 2)}${perPack}.`
  }

  /**
   * The stock unit is immutable once the product has any `StockMovement`
   * (MULTI_VENDOR_INVENTORY_DESIGN.md §5.3): it is the unit every historical quantity is
   * implicitly recorded in, so changing it later would silently reinterpret every past movement
   * rather than convert anything. The server enforces that; this form did not, so the field
   * offered a choice it would then reject — a control that looks available and is not is a worse
   * failure than one that explains itself, and Odoo locks its product UoM the same way (and for
   * the same reason) once stock moves exist.
   *
   * One extra request, on the edit route only — `useStockHistory` no-ops without a product id.
   * "Unknown" (a failed or still-loading fetch) deliberately falls to UNLOCKED: a false lock would
   * strand someone who legitimately needs to set a unit, whereas a false unlock still hits the
   * server's own rule and produces an attributed error. Degrade toward the user's freedom, not
   * away from it.
   */
  const { data: stockHistory } = useStockHistory(isEdit ? id : undefined, 0)
  const stockUnitLocked = isEdit && (stockHistory?.totalElements ?? 0) > 0

  function handleImageFileSelect(selected: File | null) {
    setImageFile(selected)
    if (selected) setRemoveImage(false)
  }

  /**
   * Which identity fields this save actually changes, by the same comparison the server makes
   * — a value resent unchanged is not an edit, so retyping a name identically must not warn.
   * The photo is compared by intent rather than by value: a new file or an explicit removal is
   * a change, and there is nothing on the client to diff a File against a URL.
   */
  function changedIdentityLabels(values: ProductFormValues): string[] {
    if (!product) return []
    const changed = IDENTITY_FIELDS.filter(({ field }) => {
      // `?? ''` throughout: the API omits null fields entirely, so an unset brand arrives as
      // undefined and comparing it to the form's '' would report a change on every save.
      const before = product[field] ?? ''
      return String(values[field] ?? '').trim() !== String(before).trim()
    }).map(({ label }) => label)

    if (imageFile || removeImage) changed.push('Photo')
    return changed
  }

  /**
   * Whether brand needs its own request.
   *
   * On an edit, only when it actually moved — the route re-triggers review on a real brand
   * change and a needless call is a needless round trip. On a create there is no "before", so
   * it is sent whenever the vendor typed something.
   *
   * <p>Used to also cover `unitOfMeasure`, back when both travelled through this route. That
   * field now goes to `/api/products` in the SAME request as everything else (see
   * `toProductPayload`), so this only has one field left to ask about.
   */
  function brandChanged(values: ProductFormValues): boolean {
    if (!isEdit) return values.brand.length > 0
    if (!product) return false
    return values.brand.trim() !== (product.brand ?? '').trim()
  }

  /**
   * The second request, and the reason there has to be one.
   *
   * `/api/products` has never accepted brand; the seller's marketplace-details route is the
   * only thing that writes it, and it needs a product id, which on a create does not exist
   * until the first request has returned. So the order is fixed: save the product, then set
   * its brand.
   *
   * <p>The failure is handled rather than propagated, because the product IS saved by the time
   * this runs and throwing here would show a red error over a successful save and send the
   * vendor round again to create a duplicate. A vendor whose brand did not stick is told
   * exactly that, and can fix it by editing — which is a far smaller problem than the one a
   * rollback would invent.
   *
   * @returns null on success, or a sentence to append to the success toast.
   */
  async function saveBrand(productId: string, values: ProductFormValues): Promise<string | null> {
    try {
      await vendorCatalogueApi.updateMarketplaceDetails(productId, toVendorMarketplaceDetailsPayload(values))
      return null
    } catch (err) {
      return isAppError(err)
        ? `but the brand could not be saved (${err.message}) — edit the product to try again.`
        : 'but the brand could not be saved — edit the product to try again.'
    }
  }

  /**
   * A number the user typed in packs, in the stock units the wire carries — `UNIT_UX_CONTRACT.md`
   * §9.1's "converted to stock units and rounded HALF_UP at scale 0 on the way in, exactly as
   * §3.1 rounds every other quantity".
   *
   * <h2>Why the conversion happens here and not in `schemas.ts`</h2>
   * `toProductPayload` / `toInitialVendorPayload` are pure functions of the form values and know
   * nothing about the fetched unit list, so they cannot resolve a pack's factor. Rather than
   * thread the unit set through them — they belong to another module (contract §0's ownership
   * map puts `schemas.ts` with the stock modals) — the payload is built as it always was and the
   * two §9.1 quantities are overridden on top of it. One place, both fields, next to the request
   * they ride on.
   *
   * Returns `undefined` for a blank field, never `0`: an omitted `lowStockThreshold` means "no
   * alert", and sending zero would mean "alert me when it hits nothing".
   */
  function toStockUnits(typed: string): number | undefined {
    if (!typed) return undefined
    const value = Number(typed)
    if (!Number.isFinite(value)) return undefined
    // No pack configured ⇒ factor 1 ⇒ the number is already in stock units, which is precisely
    // the behaviour every caller had before this amendment (§7.8).
    return quantityOption ? toBaseQuantity(value, quantityOption) : value
  }

  async function save(values: ProductFormValues) {
    setFormError(null)
    try {
      const willReview = isVendor && isEdit && changedIdentityLabels(values).length > 0
      // §9.1 — both catalog quantities count packs when the row declares one. The wire is
      // unchanged and still carries stock units, so the conversion happens on this side of the
      // request rather than becoming a new field on it.
      const lowStockThreshold = toStockUnits(values.lowStockThreshold)
      const initialVendor = toInitialVendorPayload(values)
      const saved =
        isEdit && id
          ? await productsApi.update(
              id,
              { ...toProductUpdatePayload(values), lowStockThreshold, removeImage: removeImage || undefined },
              imageFile,
            )
          : // The "First supplier" block (§7.1) rides in the SAME create request as everything
            // else — one atomic write for the product, its first ProductVendor row, and the
            // opening stock-in, rather than a create followed by a second stock-in call the
            // user could abandon halfway through. `toInitialVendorPayload` returns undefined
            // when the block was left blank, so this is a no-op for a product created with no
            // supplier or stock yet.
            await productsApi.create(
              {
                ...toProductPayload(values),
                lowStockThreshold,
                initialVendor: initialVendor && {
                  ...initialVendor,
                  // Opening stock, in packs, as the stock units the stock-in ledger records.
                  quantity: toStockUnits(values.initialVendorQuantity) ?? initialVendor.quantity,
                },
              },
              imageFile,
            )

      // Vendors only. ProcurePal's staff set brand on the admin catalogue screen, and an
      // ordinary buying company has no marketplace facets at all — the route would 403 them,
      // which is why the input is not rendered for either.
      const detailsWarning = isVendor && brandChanged(values) ? await saveBrand(saved.id, values) : null

      setPendingValues(null)

      if (detailsWarning) {
        showToast(`Product saved, ${detailsWarning}`, 'error')
      } else if (saved.warnings?.length) {
        showToast(`Product saved, but ${saved.warnings.join(' ')}`, 'success')
      } else if (willReview) {
        // Stated after the fact as well as before it: the listing has visibly changed state,
        // and a bare "Product updated." would leave a vendor to discover the rest from the
        // catalogue screen.
        showToast('Saved. This listing is back with us for review and will return to the storefront once approved.', 'success')
      } else if (isVendor && !isEdit) {
        showToast('Product created. It goes for a quick review before buyers can see it.', 'success')
      } else {
        showToast(isEdit ? 'Product updated.' : 'Product created.', 'success')
      }
      navigate(`/app/products/${saved.id}`)
    } catch (err) {
      setPendingValues(null)
      if (!isAppError(err)) {
        setFormError('Something went wrong. Please try again.')
        return
      }

      if (err.status === 409) {
        setError('sku', { message: err.message })
        return
      }

      let mappedAny = false
      for (const fieldError of err.errors ?? []) {
        if (fieldError.field && KNOWN_FIELDS.has(fieldError.field as keyof ProductFormValues)) {
          setError(fieldError.field as keyof ProductFormValues, { message: fieldError.message })
          mappedAny = true
        }
      }
      if (mappedAny) return

      // Also where UnitPriceRequiredException, InvalidUnitOfMeasureException and
      // UnitOfMeasureAndCountRequiredTogetherException land if they ever reach the server
      // despite the client-side checks above (`onSubmit`'s vendor check, the schema's
      // superRefine pairing rule, and the <select> making an invalid code structurally
      // impossible from this UI). All three are plain `{message}` bodies with no `errors`
      // array, so `err.errors ?? []` above is empty, `mappedAny` stays false, and they fall
      // through to here as a general form error rather than being silently dropped.
      setFormError(err.message)
    }
  }

  /**
   * Validation runs first, then the confirmation — so a vendor is never asked to accept a
   * review they were going to fail validation for anyway.
   *
   * <p>Unit price's "required for a vendor" rule is enforced HERE rather than in
   * `productFormSchema`, because the schema has no way to know whether the caller is a vendor
   * — it is one static shape shared by both tenant kinds, and baking `isVendor` into it would
   * mean carrying a second schema instance just for this one field. This mirrors the server's
   * own `UnitPriceRequiredException`, which is why the message matches it exactly.
   */
  async function onSubmit(values: ProductFormValues) {
    if (isVendor && values.unitPrice.trim().length === 0) {
      setError('unitPrice', { message: UNIT_PRICE_REQUIRED_MESSAGE })
      return
    }

    // §3.1's round-to-zero refusal, and §9.1 is what makes it reachable from this form: a
    // quantity typed in packs is multiplied on its way to the ledger, so it cannot vanish — but
    // it can be typed in a pack whose factor is below one (a "Dozen of 0.5 g" against a kg stock
    // unit), and a disappearing opening stock written as a silent 0 is the class of defect this
    // whole remediation exists to close. Checked here rather than left to a 400 so the message
    // lands on the field that caused it.
    if (quantityOption != null && stockUnitLabel != null) {
      for (const field of ['initialVendorQuantity', 'lowStockThreshold'] as const) {
        const typed = Number(values[field])
        if (values[field] && Number.isFinite(typed) && !convertsCleanly(typed, quantityOption)) {
          setError(field, { message: roundsToZeroMessage(typed, quantityOption, stockUnitLabel) })
          return
        }
      }
    }
    if (isVendor && isEdit) {
      const changed = changedIdentityLabels(values)
      if (changed.length > 0) {
        setChangedIdentityFields(changed)
        setPendingValues(values)
        return
      }
    }
    await save(values)
  }

  if (isEdit && loadingProduct) {
    return <ProductFormSkeleton />
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-semibold text-neutral-900">{isEdit ? 'Edit product' : 'Add product'}</h1>
      </div>

      {isVendor && <ReviewImpactNotice mode={isEdit ? 'edit' : 'create'} />}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        {/* -------------------------------------------------------------- Product image */}
        {/* No section header — self-evidently its own thing at the top of the form. */}
        <div>
          <p className="mb-1.5 text-sm font-medium text-neutral-700">Product image</p>
          <ImageUploadField
            file={imageFile}
            existingImageUrl={product?.imageUrl}
            removed={removeImage}
            onFileSelect={handleImageFileSelect}
            onRemove={() => setRemoveImage(true)}
          />
        </div>

        {/* -------------------------------------------------------------- Basic details */}
        {/* Every tenant gets a section header here — a flat run of Name/SKU/Description with no
            structure at all is the "confusing" complaint this restructuring exists to fix. Only
            the COPY differs by audience: a vendor sees the review-consequence framing (Clock,
            warning-600, "sends the listing back for review"), because renaming or re-describing
            a live listing really does take it off the storefront pending re-approval. A buying
            company's private stock is never moderated, so that warning would be describing a
            queue it never enters — it gets a neutral heading instead. The FIELDS below are
            identical either way; only the framing around them changes. */}
        {isVendor ? (
          <div className="flex items-center gap-2 border-b border-neutral-200 pb-2">
            <Clock className="h-4 w-4 shrink-0 text-warning-600" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">What the product is</h2>
              <p className="text-xs text-neutral-500">Changing anything here sends the listing back for review.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 border-b border-neutral-200 pb-2">
            <Tag className="h-4 w-4 shrink-0 text-neutral-600" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">Basic details</h2>
              <p className="text-xs text-neutral-500">Name, SKU, and description for this product.</p>
            </div>
          </div>
        )}

        <TextField label="Name" error={errors.name?.message} {...register('name')} />
        <TextField label="SKU" error={errors.sku?.message} {...register('sku')} />

        <div>
          <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Description
          </label>
          <textarea
            id="description"
            rows={3}
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
            {...register('description')}
          />
        </div>

        {/* Brand. Vendors only, and inside the "Basic details" group rather than after it,
            because that grouping is the form's whole explanation of which edits cost a listing
            its place on the storefront — putting an identity field outside it would quietly
            make the rule wrong.

            Not rendered for anyone else, and the reason differs by audience rather than being
            one blanket rule: an ordinary buying company's private stock has no marketplace
            facets at all and the seller route would 403 them, while ProcurePal's staff set
            this on the admin catalogue screen (MarketplaceDetailsModal), which also offers the
            slug and the category a vendor deliberately does not get.

            Posts to a DIFFERENT endpoint from every other field on this form — see `saveBrand`.
            That is invisible here on purpose: which of two routes a field lands on is the API's
            problem, not the supplier's. Unit of measure USED to sit next to this for the same
            reason; it now goes through `/api/products` with everything else and lives below,
            ungated, because every tenant can set it. */}
        {isVendor && (
          <TextField
            label="Brand"
            hint="Optional. The name a buyer would recognise — Dangote, Golden Penny."
            error={errors.brand?.message}
            {...register('brand')}
          />
        )}

        {/* ------------------------------------------------- How you count and pack this product */}
        {/* Rendered for EVERY tenant, not gated on `isVendor` — unlike brand, this is a universal
            product attribute: a buying company gets it as new capability (it had nothing like it
            before), and a seller gets it moved into this same request instead of the second one
            brand still needs (`toProductPayload` vs `toVendorMarketplaceDetailsPayload`).

            Three fields for three concepts, named per `UNIT_UX_CONTRACT.md` §1 and laid out to
            say how they relate:

              Stock unit                what every stored quantity is counted in
              Pack + Units per pack     an optional named container, and how much fits in it

            The pair sits on one row because §1 makes them ONE idea — a Pack is always rendered as
            the single phrase "Bag of 50 kg", never as a noun and a number a reader has to join up
            themselves. Stock unit gets its own row above them because both depend on it: "50" is
            meaningless until the form knows 50 of WHAT, which is why "Units per pack" reads its
            suffix live off the select above rather than from a static example sentence at the
            bottom of the group (that sentence is deleted — plan §6.1). Odoo's product form groups
            its UoM fields the same way, and Zoho's Unit Group configuration states the base unit
            beside every conversion for the same reason.

            Both <select>s are populated only with codes the server just returned via
            `useUnitOfMeasureOptions`, split by `role` — which is what makes an invalid or
            wrong-role code structurally impossible from this UI, so the schema does not validate
            the value against the list. packagingUnit + packagingSize are optional together
            (both-or-neither) and require unitOfMeasure, both enforced by the schema's
            superRefine.

            THIS GROUP MOVED, and the move is the point of `UNIT_UX_CONTRACT.md` §9 on this
            screen. It used to sit below Pricing and below the stock-alert field. Under §9.1 a
            quantity's MEANING now depends on the pack — "32" is thirty-two bags or thirty-two
            kilograms depending on three fields — so a form that asked for the quantity first was
            asking a question whose answer it had not yet given the reader the means to give. The
            counting fields come first now, everywhere on the form: nothing below this group is a
            quantity or a price that this group does not already define the unit of.

            That ordering is not invented here. Odoo 18's product form puts Unit of Measure and
            Purchase UoM together in the General Information tab, above the quantities on the
            Inventory tab; NetSuite's Units Type / base-unit setup precedes any stock figure that
            references it; and Zoho Inventory's Unit Group states the base unit beside every
            conversion it appears in. The common rule is that the definition of a unit is
            configuration and precedes the counting, and every one of those products learned it
            the way this one just did. */}
        <div>
          <div className="mb-3 flex items-center gap-2 border-b border-neutral-200 pb-2">
            <Ruler className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">How you count and pack this product</h2>
              <p className="text-xs text-neutral-500">
                What one unit of it means, and — optionally — what it arrives in.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                {/* A locked stock unit is rendered as text, not a <select>, so there is no
                    control for this label to point at — pointing it at a hidden input would send
                    a screen reader somewhere invisible. */}
                <label
                  htmlFor={stockUnitLocked ? undefined : 'unitOfMeasure'}
                  className="block text-sm font-medium text-neutral-700"
                >
                  {UNIT_COPY.STOCK_UNIT}{' '}
                  {!stockUnitLocked && <span className="font-normal text-neutral-400">(optional)</span>}
                </label>
                <button
                  type="button"
                  onClick={() => setShowUnitRequestModal(true)}
                  className="shrink-0 rounded-sm text-xs font-medium text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  Can&apos;t find your unit?
                </button>
              </div>

              {stockUnitLocked ? (
                <>
                  {/* Locked, with the reason on screen. The value still submits — a disabled
                      <select> contributes nothing to form state, and `toProductPayload` would
                      then send `unitOfMeasure: undefined` and quietly try to clear the very field
                      that cannot change. The hidden input keeps react-hook-form's value intact. */}
                  <input type="hidden" {...register('unitOfMeasure')} />
                  <div className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
                    <Lock className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
                    <span className="text-sm font-medium text-neutral-700">
                      {baseOptions.find((option) => option.code === watchedStockUnitCode)?.label ||
                        watchedStockUnitCode ||
                        'Not set'}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-neutral-500">
                    Locked because this product already has stock movements. Every past quantity is
                    recorded in {stockUnitLabel ?? 'this unit'}, so changing it would silently rewrite what
                    those movements meant. The pack below can still be changed at any time.
                  </p>
                </>
              ) : (
                <>
                  <select
                    id="unitOfMeasure"
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none sm:max-w-xs"
                    {...register('unitOfMeasure')}
                  >
                    <option value="">No unit selected</option>
                    {baseUnitsByCategory.map((group) => (
                      <optgroup key={group.category} label={CATEGORY_LABELS[group.category]}>
                        {group.options.map((option) => (
                          <option key={option.code} value={option.code}>
                            {option.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-neutral-500">
                    What every quantity of this product is counted in. Fixed once stock starts moving.
                  </p>
                </>
              )}
              {errors.unitOfMeasure?.message && (
                <p className="mt-1.5 text-xs text-danger-600">{errors.unitOfMeasure.message}</p>
              )}
            </div>

            {/* Pack and Units per pack — one idea, one row. Stacks at 360px. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="packagingUnit" className="mb-1.5 block text-sm font-medium text-neutral-700">
                  {UNIT_COPY.PACK} <span className="font-normal text-neutral-400">(optional)</span>
                </label>
                <select
                  id="packagingUnit"
                  className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                  {...register('packagingUnit')}
                >
                  <option value="">None — sold loose</option>
                  {packagingOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {errors.packagingUnit?.message && (
                  <p className="mt-1.5 text-xs text-danger-600">{errors.packagingUnit.message}</p>
                )}
              </div>

              {/* The live suffix. "Units per pack" alone leaves "units of what?" unanswered, and
                  the answer is already on screen one field up — so it is read from there and
                  repeated here as you type ("50 kg per bag") rather than left to be inferred.
                  Before a stock unit is chosen there is nothing truthful to say, so the field
                  falls back to naming what it needs instead of guessing. */}
              <TextField
                label={UNIT_COPY.UNITS_PER_PACK}
                inputMode="decimal"
                hint={packHint ?? `Set a ${UNIT_COPY.STOCK_UNIT.toLowerCase()} and a ${UNIT_COPY.PACK.toLowerCase()} first`}
                error={errors.packagingSize?.message}
                {...register('packagingSize')}
              />
            </div>

            {/* The one-line live summary — plan §6.1. This sentence is the entire mental model,
                stated once, at the point of configuration, in the user's own numbers. It replaces
                a static "E.g. Measured in: Kilogram, Packaged as: Bag, Pack size: 50 → a 50kg
                bag" that described a different product than the one being edited.

                Tinted primary-50 rather than left as muted body text because it is a RESULT, not
                a hint: it reflects back what the three fields above now mean together. Colour is
                never the message — the sentence says everything on its own for anyone who cannot
                see the tint.

                A second sentence was added under `UNIT_UX_CONTRACT.md` §9.1, and it is the one
                the reported failure needed: this group no longer just describes the product, it
                decides what the numbers further down the form MEAN. Saying so here, once, at the
                point the decision is made, is cheaper than being surprised by it two fields
                later — and it is said again on each of those fields, because a reader filling one
                in is looking at one field, not at this box. */}
            {(packSummary || stockUnitLabel) && (
              <p className="rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-xs text-primary-900">
                {packSummary ?? `Stock is counted in ${stockUnitLabel}. Every quantity you enter will be in ${stockUnitLabel}.`}
                {countsInPacks && quantityOption && (
                  <>
                    {' '}
                    {/* Named individually rather than as "the quantities below", because the
                        opening-stock field is create-only and gated on VIEW_VENDORS — a sentence
                        promising a field that is not on this render is worse than a shorter one. */}
                    {showOpeningStock ? `${UNIT_COPY.OPENING_STOCK} and your alert level are` : 'Your alert level is'}{' '}
                    counted in{' '}
                    <span className="font-semibold">{pluraliseUnitNoun(unitNoun(quantityOption), 2)}</span>, not{' '}
                    {stockUnitLabel}.
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        {/* -------------------------------------------------------------- Pricing */}
        {/* Vendor-only, and only Unit price now — the marketplace selling price, required for a
            vendor (enforced in `onSubmit`, mirroring the server's UnitPriceRequiredException).
            There is no standalone "Cost price" field anywhere on this form any more: a product's
            cost is a server-computed weighted average of actual purchases (see
            MULTI_VENDOR_INVENTORY_DESIGN.md §5.3), never a value typed here. A buying company's
            only price entry point is the "First supplier" block's `initialVendorCost` below, for
            its opening purchase — so a non-vendor has nothing left to show in this section, and
            it is not rendered for them at all. */}
        {isVendor && (
          <>
            <div className="mt-2 flex items-center gap-2 border-b border-neutral-200 pb-2">
              <Zap className="h-4 w-4 shrink-0 text-accent-600" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">Pricing</h2>
                <p className="text-xs text-neutral-500">
                  This goes live straight away. Your listing stays on the storefront.
                </p>
              </div>
            </div>
            {/* "Unit price" alone was a price field with no basis — `UNIT_UX_CONTRACT.md` §7.2's
                non-negotiable, and the one this section was still failing. A selling price is per
                ONE stock unit (`CheckoutService` multiplies it by an order quantity, and order
                quantities are stock units), so the label says so, and §9.2's echo restates it per
                pack underneath: a seller who quotes ₦80,000 a bag can see at a glance whether the
                ₦1,000 they just typed is the figure they meant. */}
            <TextField
              label={stockUnitLabel ? `Unit price (₦ per ${stockUnitLabel})` : 'Unit price'}
              inputMode="decimal"
              hint={
                formatPackCostEcho(Number(watchedUnitPrice), quantityOption) ??
                (stockUnitLabel ? `What a buyer pays for one ${stockUnitLabel}.` : undefined)
              }
              error={errors.unitPrice?.message}
              {...register('unitPrice')}
            />
          </>
        )}

        {/* -------------------------------------------------------------- First supplier (optional) */}
        {/* "First supplier" (§7.1 of the multi-vendor inventory design) — create only. A product no
            longer has ONE supplier field; it has many `ProductVendor` rows, added and edited
            from the Vendors tab on the product detail page. This section is the exception: the
            FIRST such row is folded into product creation itself, so someone who already knows
            who they're buying from and how much arrived doesn't have to save the product, then
            open a second screen to record the delivery. It stays optional — a product can still
            be created with zero stock and no vendor, e.g. cataloguing ahead of a first delivery —
            and is gated the same way the old Supplier field was, on VIEW_VENDORS, since it needs
            the vendor directory to offer anyone to pick.

            Unlike every section above, this one gets a real card (rounded-lg border + tinted
            neutral-50 background) rather than a plain divider — it is the one genuinely
            optional, skippable block on the form, and that extra visual weight is what signals
            "distinct and skippable" rather than "another required section". Neutral-tinted, not
            primary/accent-tinted, so it doesn't read as a call-to-action. */}
        {showOpeningStock && (
          <div className="mt-2 flex flex-col gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">
                  First {UNIT_COPY.SUPPLIER.toLowerCase()}{' '}
                  <span className="font-normal text-neutral-400">(optional)</span>
                </h2>
                <p className="text-xs text-neutral-500">
                  Who you're buying this from, what it cost, and how much arrived — this becomes the product's
                  first {UNIT_COPY.SUPPLIER.toLowerCase()} record and its opening stock, in one step.
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="initialVendorId" className="mb-1.5 block text-sm font-medium text-neutral-700">
                {UNIT_COPY.SUPPLIER}
              </label>
              <select
                id="initialVendorId"
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                {...register('initialVendorId')}
              >
                <option value="">No {UNIT_COPY.SUPPLIER.toLowerCase()} yet</option>
                {vendorOptions.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                    {/* The kind is spelled out in the option text because a <select> cannot carry
                        a badge, and "which of these is an actual ProcurePaddy seller" is the same
                        question the directory list answers with one. */}
                    {vendor.kind === 'VERIFIED' ? ' (ProcurePaddy seller)' : ''}
                  </option>
                ))}
              </select>
              {errors.initialVendorId?.message && (
                <p className="mt-1.5 text-xs text-danger-600">{errors.initialVendorId.message}</p>
              )}
            </div>

            {/* The two halves of the opening delivery, and they are deliberately counted in
                DIFFERENT units — `UNIT_UX_CONTRACT.md` §9.1 and §9.2 pulling in opposite
                directions, which is why each one says its own on its face rather than inheriting
                a basis from the block around it.

                  Cost           per STOCK UNIT (§9.2) — the only figure comparable across
                                 suppliers whose packs differ, which is the job it does. It
                                 becomes `Product.costPrice`, per kg.
                  Opening stock  in PACKS when the row declares one (§9.1) — deliveries arrive
                                 in bags and an invoice counts bags (§9.3's receiving default).

                "Cost / Per unit" and a bare "Quantity received" were the same unnamed basis that
                produced the 50× costing error this remediation exists to close (plan §3's P0-1)
                and the 12-kg-for-twelve-bags report §9 exists to close. Both now carry a live
                echo of the other reading: §9.2's per-pack cost, and §9.1's stock-unit quantity.
                Stacks at 360px. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label={packNoun ? `Cost (₦ per ${packNoun})` : stockUnitLabel ? `Cost (₦ per ${stockUnitLabel})` : 'Cost'}
                inputMode="decimal"
                hint={
                  formatStockUnitCostEcho(Number(watchedInitialCost), quantityOption, stockUnitLabel ?? '') ??
                  (stockUnitLabel
                    ? `What you pay for one ${stockUnitLabel} — not for a whole pack`
                    : `Per ${UNIT_COPY.STOCK_UNIT.toLowerCase()}`)
                }
                error={errors.initialVendorCost?.message}
                {...register('initialVendorCost')}
              />
              <TextField
                label={fieldLabelInUnit(UNIT_COPY.OPENING_STOCK, quantityOption)}
                inputMode="decimal"
                hint={quantityHint(watchedOpeningStock)}
                error={errors.initialVendorQuantity?.message}
                {...register('initialVendorQuantity')}
              />
            </div>

            <p className="text-xs text-neutral-500">
              <Link to="/app/vendors" className="font-medium text-primary-600 hover:underline">
                Manage your {UNIT_COPY.SUPPLIERS.toLowerCase()}
              </Link>
              .
            </p>
          </div>
        )}

        {/* -------------------------------------------------------------- Stock alerts */}
        {/* Last, and directly under Opening stock, because the two are one idea now: both are
            §9.1 quantities, both count the same thing in the same unit, and a reader who has just
            decided "32 bags arrived" is in exactly the right frame of mind to answer "tell me when
            it falls to 4". It used to sit above the First supplier block, where the only quantity
            it could be compared against was several hundred pixels away.

            "Low stock threshold" named the database column, not the question — §9.4 renames it to
            the question. `inputMode` moves from numeric to decimal for the same reason §9.1 accepts
            decimals: half a bag is a real shelf, and a numeric keypad with no decimal point on a
            phone would make it untypeable. */}
        <div>
          <div className="mb-2 flex items-center gap-2 border-b border-neutral-200 pb-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warning-600" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-neutral-900">Stock alerts</h2>
          </div>
          <TextField
            label={fieldLabelInUnit(UNIT_COPY.LOW_STOCK_ALERT_AT, quantityOption)}
            inputMode="decimal"
            hint={quantityHint(watchedLowStock) ?? 'Get an alert when what you have on hand drops to this or below'}
            error={errors.lowStockThreshold?.message}
            {...register('lowStockThreshold')}
          />
        </div>

        <FormError message={formError} />

        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Create product'}
          </Button>
        </div>
      </form>

      <ReviewImpactDialog
        open={pendingValues !== null}
        changedFields={changedIdentityFields}
        saving={isSubmitting}
        onConfirm={() => {
          if (pendingValues) void save(pendingValues)
        }}
        onCancel={() => setPendingValues(null)}
      />

      {showUnitRequestModal && (
        <RequestUnitOfMeasureModal
          onClose={() => setShowUnitRequestModal(false)}
          onSuccess={() => {
            setShowUnitRequestModal(false)
            showToast("Thanks — we'll review this unit.", 'success')
          }}
        />
      )}
    </div>
  )
}
