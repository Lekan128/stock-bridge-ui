import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { ArrowLeft, Clock, Zap } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
  toProductPayload,
  toProductUpdatePayload,
  toVendorMarketplaceDetailsPayload,
  type ProductFormValues,
} from '@/features/products/schemas'
import type { UnitOfMeasureCategory } from '@/features/products/types'
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
  'costPrice',
  'lowStockThreshold',
  'companyVendorId',
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
const IDENTITY_FIELDS: { field: keyof ProductFormValues; label: string }[] = [
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
 * <h2>Only vendors see any of it</h2>
 * Gated on `isVendor`, which mirrors the server's own condition:
 * `ProductModerationRules.isModerated` is true for a seller that is not the platform owner.
 * ProcurePal's own products are stamped APPROVED at write time and a buying company's private
 * stock list is never moderated at all — telling either of them their napkin count is going
 * for review would be a false statement about a queue they will never enter. The grouping
 * headings are hidden with the notice for the same reason: to a buying company they would
 * describe a rule that does not apply to them.
 */
export function ProductFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
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
    defaultValues: productFormDefaults(),
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
      costPrice: product.costPrice != null ? String(product.costPrice) : '',
      lowStockThreshold: product.lowStockThreshold != null ? String(product.lowStockThreshold) : '',
      companyVendorId: product.companyVendorId ?? '',
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
              // toProductUpdatePayload, not toProductPayload: clearing the supplier has to be said
              // out loud, because an absent companyVendorId means "leave it alone" server-side.
              { ...toProductUpdatePayload(values), removeImage: removeImage || undefined },
              imageFile,
            )
          : await productsApi.create(toProductPayload(values), imageFile)

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
        {/* ------------------------------------------------------------------ What it IS */}
        {/* The heading and rule are rendered only for vendors: to a buying company they would
            describe a queue their private stock list never enters. The FIELDS below are
            identical either way — only the framing around them changes. */}
        {isVendor && (
          <div className="flex items-center gap-2 border-b border-neutral-200 pb-2">
            <Clock className="h-4 w-4 shrink-0 text-warning-600" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">What the product is</h2>
              <p className="text-xs text-neutral-500">Changing anything here sends the listing back for review.</p>
            </div>
          </div>
        )}

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

        {/* Brand. Vendors only, and inside the "what the product is" group rather than after
            it, because that grouping is the form's whole explanation of which edits cost a
            listing its place on the storefront — putting an identity field outside it would
            quietly make the rule wrong.

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

        {/* -------------------------------------------------------- Price, stock, bookkeeping */}
        {isVendor && (
          <div className="mt-2 flex items-center gap-2 border-b border-neutral-200 pb-2">
            <Zap className="h-4 w-4 shrink-0 text-accent-600" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">Price and stock</h2>
              <p className="text-xs text-neutral-500">
                These go live straight away. Your listing stays on the storefront.
              </p>
            </div>
          </div>
        )}

        {/* Unit price is a marketplace selling price — meaningless for a buying company's
            private stock, and required for a vendor (enforced in `onSubmit`, mirroring the
            server's UnitPriceRequiredException). A company keeps only cost price, which stays
            optional and unconstrained by tenant kind either way. */}
        {isVendor ? (
          <div className="grid grid-cols-2 gap-4">
            <TextField
              label="Unit price"
              inputMode="decimal"
              error={errors.unitPrice?.message}
              {...register('unitPrice')}
            />
            <TextField
              label="Cost price"
              inputMode="decimal"
              hint="Optional"
              error={errors.costPrice?.message}
              {...register('costPrice')}
            />
          </div>
        ) : (
          <TextField
            label="Cost price"
            inputMode="decimal"
            hint="Optional"
            error={errors.costPrice?.message}
            {...register('costPrice')}
          />
        )}

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
            How this product is measured, and — optionally — how it&apos;s packaged. E.g. Measured
            in: Kilogram, Packaged as: Bag, Pack size: 50 → a 50kg bag.
          </p>
        </div>

        <TextField
          label="Low stock threshold"
          inputMode="numeric"
          hint="Get an alert when quantity on hand drops to or below this number"
          error={errors.lowStockThreshold?.message}
          {...register('lowStockThreshold')}
        />

        {canViewVendors && (
          <div>
            <label htmlFor="companyVendorId" className="mb-1.5 block text-sm font-medium text-neutral-700">
              Supplier <span className="font-normal text-neutral-400">(optional)</span>
            </label>
            <select
              id="companyVendorId"
              aria-describedby="companyVendorId-hint"
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
              {...register('companyVendorId')}
            >
              <option value="">No supplier</option>
              {vendorOptions.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                  {/* The kind is spelled out in the option text because a <select> cannot carry a
                      badge, and "which of these is an actual ProcurePaddy seller" is the same
                      question the directory list answers with one. */}
                  {vendor.kind === 'VERIFIED' ? ' (ProcurePaddy seller)' : ''}
                </option>
              ))}
            </select>
            <p id="companyVendorId-hint" className="mt-1.5 text-xs text-neutral-500">
              {/* Says the automatic case out loud: a buyer who does not know marketplace purchases
                  fill this in themselves will assume something else set it by mistake. */}
              Where you buy this from. Items bought on the ProcurePaddy marketplace are linked to their
              seller automatically — set this by hand for stock you source elsewhere.{' '}
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
