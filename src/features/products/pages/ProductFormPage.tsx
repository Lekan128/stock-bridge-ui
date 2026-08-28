import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, Clock, Ruler, Tag, Truck, Zap } from 'lucide-react'
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
import type { Product, UnitOfMeasureCategory } from '@/features/products/types'
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

// Fixed display order for the "Measured in" picker's <optgroup>s — independent of whatever
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
// the "First vendor" fields (`initialVendorId` etc.) exist only on the form's values — there is
// no such thing as an existing product's "first vendor" to diff against — a wider type here
// would let one sneak into this list and fail to compile at the one place it's actually read.
const IDENTITY_FIELDS: { field: keyof ProductFormValues & keyof Product; label: string }[] = [
  { field: 'name', label: 'Product name' },
  { field: 'sku', label: 'SKU' },
  { field: 'description', label: 'Description' },
  { field: 'brand', label: 'Brand' },
  { field: 'unitOfMeasure', label: 'Measured in' },
  { field: 'packagingUnit', label: 'Packaged as' },
  { field: 'packagingSize', label: 'Pack size' },
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
 * Every tenant sees the form broken into labelled sections (Basic details, Measurement &amp;
 * packaging, Stock alerts, First vendor, ...) — a flat, undifferentiated field list is confusing
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
 * <h2>No standalone "Cost price" field</h2>
 * In every mainstream system with vendor-based costing (Odoo's AVCO, NetSuite's Average Cost),
 * a product's cost is a computed rollup from actual purchases, never a value typed alongside a
 * separate per-vendor purchase price for the same transaction. This app's backend already works
 * that way — `Product.costPrice` is a weighted average recalculated on every stock-in (see
 * MULTI_VENDOR_INVENTORY_DESIGN.md §5.3) — so this form never collects it directly. The only
 * place a cost is typed is the "First vendor" block's own `initialVendorCost`, for that first
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
  const { baseOptions, packagingOptions } = useUnitOfMeasureOptions()
  const [formError, setFormError] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [showUnitRequestModal, setShowUnitRequestModal] = useState(false)
  /** Held while the confirmation is open, so confirming submits exactly what was validated. */
  const [pendingValues, setPendingValues] = useState<ProductFormValues | null>(null)
  const [changedIdentityFields, setChangedIdentityFields] = useState<string[]>([])

  // "Measured in" picker — BASE-role codes only, grouped by category.
  const baseUnitsByCategory = CATEGORY_ORDER.map((category) => ({
    category,
    options: baseOptions.filter((option) => option.category === category),
  })).filter((group) => group.options.length > 0)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    // Prefilled with the name typed into the search-first "Add a product" flow, on create only —
    // an edit always starts from the product below instead. `location.state` is read once here
    // because `defaultValues` is only consulted on the form's first render; nothing re-reads it
    // after that, which is fine, since nothing navigates within this page without unmounting it.
    defaultValues: isEdit ? productFormDefaults() : { ...productFormDefaults(), name: location.state?.name ?? '' },
  })

  useEffect(() => {
    if (!product) return
    reset({
      name: product.name,
      sku: product.sku,
      description: product.description ?? '',
      brand: product.brand ?? '',
      unitOfMeasure: product.unitOfMeasure ?? '',
      packagingUnit: product.packagingUnit ?? '',
      packagingSize: product.packagingSize != null ? String(product.packagingSize) : '',
      unitPrice: product.unitPrice != null ? String(product.unitPrice) : '',
      lowStockThreshold: product.lowStockThreshold != null ? String(product.lowStockThreshold) : '',
      // The "First vendor" block only ever applies at creation — an existing product's vendors
      // live on the Vendors tab, not here — so an edit always resets these back to blank.
      initialVendorId: '',
      initialVendorCost: '',
      initialVendorQuantity: '',
    })
  }, [product, reset])

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

  async function save(values: ProductFormValues) {
    setFormError(null)
    try {
      const willReview = isVendor && isEdit && changedIdentityLabels(values).length > 0
      const saved =
        isEdit && id
          ? await productsApi.update(
              id,
              { ...toProductUpdatePayload(values), removeImage: removeImage || undefined },
              imageFile,
            )
          : // The "First vendor" block (§7.1) rides in the SAME create request as everything
            // else — one atomic write for the product, its first ProductVendor row, and the
            // opening stock-in, rather than a create followed by a second stock-in call the
            // user could abandon halfway through. `toInitialVendorPayload` returns undefined
            // when the block was left blank, so this is a no-op for a product created with no
            // vendor or stock yet.
            await productsApi.create(
              { ...toProductPayload(values), initialVendor: toInitialVendorPayload(values) },
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

        {/* -------------------------------------------------------------- Pricing */}
        {/* Vendor-only, and only Unit price now — the marketplace selling price, required for a
            vendor (enforced in `onSubmit`, mirroring the server's UnitPriceRequiredException).
            There is no standalone "Cost price" field anywhere on this form any more: a product's
            cost is a server-computed weighted average of actual purchases (see
            MULTI_VENDOR_INVENTORY_DESIGN.md §5.3), never a value typed here. A buying company's
            only price entry point is the "First vendor" block's `initialVendorCost` below, for
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
            <TextField
              label="Unit price"
              inputMode="decimal"
              error={errors.unitPrice?.message}
              {...register('unitPrice')}
            />
          </>
        )}

        {/* -------------------------------------------------------------- Measurement & packaging */}
        {/* Measured in / Packaged as / Pack size. Rendered for EVERY tenant, not gated on
            `isVendor` — unlike brand, this is now a universal product attribute: a buying
            company gets it as new capability (it had nothing like it before), and a vendor gets
            it moved into this same request instead of the second one brand still needs (see
            `toProductPayload` vs `toVendorMarketplaceDetailsPayload`).

            Three fields for three concepts (Odoo's model): what it's measured in, how it's
            packaged (optional — some goods are sold loose), and how many of the former fit in
            one of the latter. packagingUnit + packagingSize are optional together (both-or-
            neither) but never independently, AND require unitOfMeasure to also be set — both
            rules enforced by the schema's superRefine (see `productFormSchema`).

            Both <select>s are populated only with codes the server just returned via
            `useUnitOfMeasureOptions`, split by `role` — this is what makes an invalid or
            wrong-role code structurally impossible from this UI, so the schema itself does not
            need to validate the value against the list (see the comment there). */}
        <div>
          <div className="mb-2 flex items-center gap-2 border-b border-neutral-200 pb-2">
            <Ruler className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">Measurement &amp; packaging</h2>
              <p className="text-xs text-neutral-500">How this product is measured, and — optionally — packaged.</p>
            </div>
          </div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-neutral-700">Unit of measure</span>
            <button
              type="button"
              onClick={() => setShowUnitRequestModal(true)}
              className="shrink-0 text-xs font-medium text-primary-600 hover:underline"
            >
              Can&apos;t find your unit?
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="unitOfMeasure" className="mb-1.5 block text-sm font-medium text-neutral-700">
                Measured in <span className="font-normal text-neutral-400">(optional)</span>
              </label>
              <select
                id="unitOfMeasure"
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
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
              {errors.unitOfMeasure?.message && (
                <p className="mt-1.5 text-xs text-danger-600">{errors.unitOfMeasure.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="packagingUnit" className="mb-1.5 block text-sm font-medium text-neutral-700">
                Packaged as <span className="font-normal text-neutral-400">(optional)</span>
              </label>
              <select
                id="packagingUnit"
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                {...register('packagingUnit')}
              >
                <option value="">— None — (sold loose)</option>
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
          </div>
          <div className="mt-4">
            <TextField
              label="Pack size"
              inputMode="decimal"
              hint="Only relevant when Packaged as is set"
              error={errors.packagingSize?.message}
              {...register('packagingSize')}
            />
          </div>
          <p className="mt-1.5 text-xs text-neutral-500">
            E.g. Measured in: Kilogram, Packaged as: Bag, Pack size: 50 → a 50kg bag.
          </p>
        </div>

        {/* -------------------------------------------------------------- Stock alerts */}
        <div>
          <div className="mb-2 flex items-center gap-2 border-b border-neutral-200 pb-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warning-600" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-neutral-900">Stock alerts</h2>
          </div>
          <TextField
            label="Low stock threshold"
            inputMode="numeric"
            hint="Get an alert when quantity on hand drops to or below this number"
            error={errors.lowStockThreshold?.message}
            {...register('lowStockThreshold')}
          />
        </div>

        {/* -------------------------------------------------------------- First vendor (optional) */}
        {/* "First vendor" (§7.1 of the multi-vendor inventory design) — create only. A product no
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
        {!isEdit && canViewVendors && (
          <div className="mt-2 flex flex-col gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">
                  First vendor <span className="font-normal text-neutral-400">(optional)</span>
                </h2>
                <p className="text-xs text-neutral-500">
                  Who you're buying this from, what it cost, and how much arrived — this becomes the product's
                  first vendor record and its opening stock, in one step.
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="initialVendorId" className="mb-1.5 block text-sm font-medium text-neutral-700">
                Vendor
              </label>
              <select
                id="initialVendorId"
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                {...register('initialVendorId')}
              >
                <option value="">No vendor yet</option>
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

            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Cost"
                inputMode="decimal"
                hint="Per unit"
                error={errors.initialVendorCost?.message}
                {...register('initialVendorCost')}
              />
              <TextField
                label="Quantity received"
                inputMode="numeric"
                error={errors.initialVendorQuantity?.message}
                {...register('initialVendorQuantity')}
              />
            </div>

            <p className="text-xs text-neutral-500">
              <Link to="/app/vendors" className="font-medium text-primary-600 hover:underline">
                Manage your vendor directory
              </Link>
              .
            </p>
          </div>
        )}

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
