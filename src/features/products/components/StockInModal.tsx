import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { Modal } from '@/components/Modal'
import { TextField } from '@/components/TextField'
import { stockApi } from '@/features/products/api/stockApi'
import { UnitToggle, type UnitToggleOption } from '@/features/products/components/UnitToggle'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import { useProductVendors } from '@/features/products/hooks/useProductVendors'
import { makeStockInSchema, type StockInFormValues } from '@/features/products/schemas'
import { formatCount, toBaseQuantity } from '@/features/products/stockUnitMath'
import type { Product, StockInPayload, StockMutationResponse } from '@/features/products/types'
import type { ProductVendor } from '@/features/products/vendors/types'
import { useVendorOptions } from '@/features/vendors/hooks/useVendorOptions'
import { formatNaira } from '@/utils/money'
import { isAppError } from '@/types/api'

export interface StockInModalProps {
  product: Product
  onClose: () => void
  onSuccess: (result: StockMutationResponse) => void
}

type Step = 'form' | 'confirm' | 'receipt'

/** Best applicable price for `vendor` at `baseQuantity` — highest-`minQuantity` tier that still
 *  qualifies, falling back to the flat `lastCostPrice` when the vendor has no tiers (or none
 *  qualify yet). `null` when nothing is known about this vendor's price at all. */
function resolvedVendorPrice(vendor: ProductVendor, baseQuantity: number): number | null {
  if (vendor.priceTiers.length > 0) {
    const applicable = [...vendor.priceTiers].filter((t) => baseQuantity >= t.minQuantity).sort((a, b) => b.minQuantity - a.minQuantity)[0]
    if (applicable) return applicable.unitPrice
  }
  return vendor.lastCostPrice ?? null
}

/**
 * Stock-in, rebuilt per the multi-vendor inventory design (§6, §7.3): quantity + a compact
 * base⟷packaging unit toggle is the whole simple-path form; a vendor picker only appears when
 * there's real ambiguity (the product has 2+ vendors on file, or none yet); a single "Choose
 * vendor / unit manually" disclosure covers BOTH manual vendor selection and the full unit list,
 * never two separate toggles; and a read-only confirmation screen (§7.3's exact shape) sits
 * between the form and the actual request.
 *
 * <h2>Step machine</h2>
 * `form` → (validated) → `confirm` → (submits) → `receipt`. `Edit` on the confirm screen goes
 * back to `form` with every value intact (it's the same react-hook-form instance, nothing is
 * cleared). The receipt step is a deliberate pause before calling `onSuccess` — the parent
 * (`ProductDetailPage`) closes this modal the instant `onSuccess` fires, so calling it eagerly on
 * a bare "200 OK" would skip the receipt-style breakdown the design asks for entirely.
 *
 * <h2>Vendor field visibility — the one place this component earns its complexity</h2>
 * Sourced from `useProductVendors` (this product's OWN vendor lines, not the company's whole
 * directory):
 * - 0 vendors on file: this is the product's first-ever vendor. The picker is shown (sourced
 *   from the company's full directory, `useVendorOptions`), with NO default — the user picks
 *   normally, same as any other required field.
 * - Exactly 1 vendor: no real choice exists, so the field is not rendered at all — that vendor's
 *   id is used silently.
 * - 2+ vendors: real ambiguity, so the picker is shown, defaulted to whichever is `isPreferred`,
 *   or the first row if none is pinned. The API's `ProductVendor` list has no explicit
 *   "last used" timestamp, so list order is trusted as the "most recently used" proxy per
 *   §7.3 — a judgment call, flagged in the module's final report.
 *
 * The "Choose vendor / unit manually" disclosure always reveals the vendor field (sourced from
 * the FULL company directory this time, not just the product's own vendors) regardless of which
 * of the three states above applies — the one required case this component's own ground-truth
 * notes call out: picking a vendor that's real but not yet linked to this product.
 */
export function StockInModal({ product, onClose, onSuccess }: StockInModalProps) {
  const { user } = useAuth()
  const canViewVendors = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.VIEW_VENDORS)
  const { vendors: directoryVendors } = useVendorOptions(canViewVendors)
  const { data: productVendors, loading: productVendorsLoading } = useProductVendors(product.id)
  const { options: unitOfMeasureOptions, baseOptions, packagingOptions } = useUnitOfMeasureOptions()

  const [step, setStep] = useState<Step>('form')
  const [advanced, setAdvanced] = useState(false)
  const [unit, setUnit] = useState('') // '' = product's base unit, matches the wire contract
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<StockMutationResponse | null>(null)

  const activeProductVendors = productVendors.filter((v) => v.companyVendorActive)
  const preferredVendor = activeProductVendors.find((v) => v.isPreferred)
  const defaultVendor = preferredVendor ?? activeProductVendors[0] ?? null

  const activeDirectoryVendors = directoryVendors.filter((v) => v.active)
  const vendorFieldVisible = advanced || activeProductVendors.length !== 1
  const vendorOptions: { id: string; label: string }[] = advanced
    ? activeDirectoryVendors.map((v) => ({ id: v.id, label: v.kind === 'VERIFIED' ? `${v.name} (ProcurePaddy seller)` : v.name }))
    : activeProductVendors.length === 0
      ? activeDirectoryVendors.map((v) => ({ id: v.id, label: v.kind === 'VERIFIED' ? `${v.name} (ProcurePaddy seller)` : v.name }))
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
    defaultValues: { quantity: '', unitPrice: '', companyVendorId: '', packagingUnit: '', packagingSize: '', note: '' },
  })

  // Silently defaults the vendor once its data is known — for a single existing vendor (no field
  // shown) as much as for a preferred/most-recent one among several (field shown, pre-filled).
  // Never overwrites a value the user (or a prior default) already set.
  useEffect(() => {
    if (productVendorsLoading) return
    if (getValues('companyVendorId')) return
    if (defaultVendor) setValue('companyVendorId', defaultVendor.companyVendorId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productVendorsLoading, defaultVendor?.companyVendorId])

  const companyVendorId = watch('companyVendorId')
  const quantityStr = watch('quantity')
  const unitPriceStr = watch('unitPrice')
  const quantityNumber = Number(quantityStr) || 0

  const baseLabel = unitOfMeasureOptions.find((o) => o.code === product.unitOfMeasure)?.label ?? product.unitOfMeasure ?? 'unit'
  const packagingLabel = product.packagingUnit
    ? (unitOfMeasureOptions.find((o) => o.code === product.packagingUnit)?.label ?? product.packagingUnit)
    : undefined

  const simpleUnitOptions: UnitToggleOption[] = [{ value: '', label: baseLabel }]
  if (product.packagingUnit && packagingLabel) simpleUnitOptions.push({ value: product.packagingUnit, label: packagingLabel })

  // Only the product's own configured packaging conversion is trustworthy enough to show a
  // parenthetical base-unit equivalent — an arbitrary code picked from the advanced full list has
  // no known conversion rate on this side, so `toBaseQuantity` falls back to the entered number
  // unchanged and no conversion line is shown for it (see `showBaseConversion` below).
  const isKnownConversion = unit !== '' && unit === product.packagingUnit
  const baseQuantity = toBaseQuantity(quantityNumber, unit, product.packagingUnit, product.packagingSize)
  const showBaseConversion = isKnownConversion && quantityNumber > 0
  const perUnitLabel = unit ? (unit === product.packagingUnit ? (packagingLabel ?? unit) : unit) : baseLabel

  const vendorIsNewToProduct = companyVendorId.length > 0 && !productVendors.some((v) => v.companyVendorId === companyVendorId)

  function vendorLabel(id: string): string {
    return (
      productVendors.find((v) => v.companyVendorId === id)?.companyVendorName ??
      directoryVendors.find((v) => v.id === id)?.name ??
      ''
    )
  }

  // Client-side preview of design spec §5.1a's cheaper-vendor hint — computed live as quantity or
  // vendor changes, rather than only after the response comes back, per the module's judgment
  // call to prefer a live preview when there's time to build one. Assumes tier `unitPrice` is
  // comparable in the same terms as `lastCostPrice` (both "per base unit"); the response's own
  // `cheaperVendorHint` (shown on the receipt step) is the authoritative figure regardless.
  let cheaperPreview: { vendorName: string; savings: number } | null = null
  const selectedVendorRecord = productVendors.find((v) => v.companyVendorId === companyVendorId)
  if (selectedVendorRecord && baseQuantity > 0) {
    const selectedPrice = resolvedVendorPrice(selectedVendorRecord, baseQuantity)
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

  function goToConfirm() {
    setStep('confirm')
  }

  async function submit() {
    setSubmitError(null)
    setSubmitting(true)
    const values = getValues()
    const payload: StockInPayload = {
      quantity: quantityNumber,
      unit: unit || undefined,
      unitPrice: values.unitPrice ? Number(values.unitPrice) : undefined,
      companyVendorId: values.companyVendorId || undefined,
      packagingUnit: values.packagingUnit || undefined,
      packagingSize: values.packagingSize ? Number(values.packagingSize) : undefined,
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

  const quantityLabel = formatCount(quantityNumber, perUnitLabel)
  const confirmVendorName = companyVendorId ? vendorLabel(companyVendorId) : ''
  const unitPriceNumber = unitPriceStr ? Number(unitPriceStr) : null

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
            <Button onClick={handleSubmit(goToConfirm)} disabled={productVendorsLoading}>
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
          <div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <TextField label="Quantity" inputMode="numeric" error={errors.quantity?.message} {...register('quantity')} />
              </div>
              <div className="pb-0.5">
                <UnitToggle value={unit} onChange={setUnit} options={simpleUnitOptions} label="Unit" />
              </div>
            </div>
            {showBaseConversion && (
              <p className="mt-1.5 text-xs text-neutral-500">= {formatCount(baseQuantity, baseLabel)}</p>
            )}
          </div>

          {vendorFieldVisible && !advanced && (
            <div>
              <label htmlFor="stock-in-vendor" className="mb-1.5 block text-sm font-medium text-neutral-700">
                Vendor
              </label>
              {productVendorsLoading ? (
                <p className="text-sm text-neutral-500">Loading vendors…</p>
              ) : vendorOptions.length === 0 ? (
                <p className="text-sm text-neutral-500">No vendors in your directory yet.</p>
              ) : (
                <select
                  id="stock-in-vendor"
                  className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                  {...register('companyVendorId')}
                >
                  <option value="">Choose a vendor</option>
                  {vendorOptions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              )}
              {errors.companyVendorId?.message && (
                <p className="mt-1.5 text-xs text-danger-600">{errors.companyVendorId.message}</p>
              )}
            </div>
          )}

          <TextField
            label="Unit price"
            inputMode="decimal"
            hint={`Optional — per ${perUnitLabel}`}
            error={errors.unitPrice?.message}
            {...register('unitPrice')}
          />

          {cheaperPreview && (
            <p className="text-sm text-primary-700">
              {cheaperPreview.vendorName} is {formatNaira(cheaperPreview.savings)} cheaper at this quantity.
            </p>
          )}

          <div>
            <button
              type="button"
              onClick={() => setAdvanced((a) => !a)}
              className="flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:underline"
            >
              {advanced ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
              Choose vendor / unit manually
            </button>
          </div>

          {advanced && (
            <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              {vendorFieldVisible && (
                <div>
                  <label htmlFor="stock-in-vendor-advanced" className="mb-1.5 block text-sm font-medium text-neutral-700">
                    Vendor <span className="font-normal text-neutral-400">(any vendor in your directory, not just this product's)</span>
                  </label>
                  {vendorOptions.length === 0 ? (
                    <p className="text-sm text-neutral-500">No vendors in your directory yet.</p>
                  ) : (
                    <select
                      id="stock-in-vendor-advanced"
                      className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                      {...register('companyVendorId')}
                    >
                      <option value="">Choose a vendor</option>
                      {vendorOptions.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {errors.companyVendorId?.message && (
                    <p className="mt-1.5 text-xs text-danger-600">{errors.companyVendorId.message}</p>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="stock-in-unit-advanced" className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Unit <span className="font-normal text-neutral-400">(full list, for a one-off delivery unit)</span>
                </label>
                <select
                  id="stock-in-unit-advanced"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                >
                  <option value="">{baseLabel} (base unit)</option>
                  {[...baseOptions, ...packagingOptions]
                    .filter((o) => o.code !== product.unitOfMeasure)
                    .map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.label}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="stock-in-packaging-unit" className="mb-1.5 block text-sm font-medium text-neutral-700">
                    Delivered as <span className="font-normal text-neutral-400">(optional)</span>
                  </label>
                  <select
                    id="stock-in-packaging-unit"
                    className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                    {...register('packagingUnit')}
                  >
                    <option value="">Same as usual</option>
                    {packagingOptions.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {errors.packagingUnit?.message && <p className="mt-1.5 text-xs text-danger-600">{errors.packagingUnit.message}</p>}
                </div>
                <TextField
                  label="Pack size"
                  inputMode="decimal"
                  hint="Only if this delivery's packaging differs"
                  error={errors.packagingSize?.message}
                  {...register('packagingSize')}
                />
              </div>
              <p className="text-xs text-neutral-500">
                Records what this specific delivery was actually packaged as, if it differs from this vendor's usual packaging — the
                vendor's default stays unchanged.
              </p>
            </div>
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

      {step === 'confirm' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <p className="text-sm text-neutral-700">
              Adding{' '}
              <span className="font-semibold text-neutral-900">
                {quantityLabel}
                {showBaseConversion && ` (${formatCount(baseQuantity, baseLabel)})`}
              </span>{' '}
              of <span className="font-semibold text-neutral-900">{product.name}</span>
              {confirmVendorName && (
                <>
                  {' '}
                  from <span className="font-semibold text-neutral-900">{confirmVendorName}</span>
                </>
              )}
              {unitPriceNumber != null && (
                <>
                  {' '}
                  at{' '}
                  <span className="font-semibold text-neutral-900">
                    {formatNaira(unitPriceNumber)}/{perUnitLabel}
                  </span>
                </>
              )}
              .
            </p>
            {/* §7.3: this line only renders when true — omitted entirely otherwise, never shown
                as an empty or "as usual" placeholder. */}
            {vendorIsNewToProduct && confirmVendorName && (
              <p className="mt-2 text-sm text-neutral-600">{confirmVendorName} is new to this product.</p>
            )}
            {cheaperPreview && (
              <p className="mt-2 text-sm text-primary-700">
                {cheaperPreview.vendorName} is {formatNaira(cheaperPreview.savings)} cheaper at this quantity.
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
              {quantityLabel}
              {showBaseConversion && ` (${formatCount(baseQuantity, baseLabel)})`} of {product.name} added
              {confirmVendorName && ` from ${confirmVendorName}`}.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm">
            <div>
              <dt className="text-neutral-500">New quantity on hand</dt>
              <dd className="mt-0.5 font-medium text-neutral-900">{formatCount(result.product.quantityOnHand, baseLabel)}</dd>
            </div>
            {result.vendorIsNewToProduct && confirmVendorName && (
              <div className="col-span-2">
                <dt className="text-neutral-500">Vendor</dt>
                <dd className="mt-0.5 text-neutral-700">{confirmVendorName} is now linked to this product.</dd>
              </div>
            )}
            {result.cheaperVendorHint && (
              <div className="col-span-2">
                <dt className="text-neutral-500">Worth knowing</dt>
                <dd className="mt-0.5 text-primary-700">
                  {result.cheaperVendorHint.companyVendorName} is {formatNaira(result.cheaperVendorHint.savingsPerUnit)} cheaper at
                  this quantity.
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </Modal>
  )
}
