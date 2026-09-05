import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { Modal } from '@/components/Modal'
import { TextField } from '@/components/TextField'
import { productVendorsApi } from '@/features/products/api/productVendorsApi'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import type { UnitOption } from '@/features/products/types'
import { UNIT_COPY, formatPriceEcho } from '@/features/products/unitCopy'
import { toBasePrice } from '@/features/products/unitSet'
import { addPackFormSchema, type AddPackFormValues } from '@/features/products/vendors/schemas'
import type { ProductVendor, ProductVendorPack } from '@/features/products/vendors/types'
import { isAppError } from '@/types/api'

export interface AddPackModalProps {
  productId: string
  vendor: ProductVendor
  /** The product's stock unit symbol ("kg") — what a bare (no-container) pack is priced in, and
   *  what every conversion preview below resolves to. */
  stockUnit: string
  onClose: () => void
  onSuccess: (pack: ProductVendorPack) => void
}

/** The packaging select's "no container" option — never a real `UnitOfMeasure` code, so it can
 *  never collide with one. */
const BARE_CONTAINER = ''

/**
 * "+ Add pack" — a vendor's second (or third…) priced offering
 * (MULTI_PACK_PER_VENDOR_DESIGN.md sections 4–7). Before this, a vendor line had exactly one
 * pack; a supplier who sells the same rice in both 25 kg and 50 kg bags had nowhere to put the
 * second one, and — worse — a pack sharing a container CODE with the product's own but a
 * different SIZE was silently dropped from the unit set entirely
 * (UNIT_UX_REMEDIATION_PLAN.md section 11.1). This form is the direct fix: a vendor can now have
 * as many packs as they actually sell in, each with its own code, cost and price breaks.
 *
 * <h2>"No container" is a real, common choice, not a disabled state</h2>
 * A vendor priced straight in the product's stock unit — no bag, no carton — is the ordinary
 * case, not a half-filled form. Choosing it hides the size field entirely rather than leaving it
 * optional beside a container select, so there is no state where a size exists with nothing
 * named to hold it (enforced again, server-side, by a CHECK constraint).
 *
 * <h2>Cost is entered per pack, stored per stock unit — the same asymmetry `AddPriceTierModal`
 * already gets right</h2>
 * A vendor's quote is naturally per bag when there is one; `ProductVendorPack.lastCostPrice` is
 * always per stock unit (`UNIT_UX_CONTRACT.md` §3.2), so the typed figure is divided by the pack's
 * size before it is sent, and the stored equivalent is echoed live so the conversion is never
 * left to mental arithmetic.
 */
export function AddPackModal({ productId, vendor, stockUnit, onClose, onSuccess }: AddPackModalProps) {
  const { packagingOptions } = useUnitOfMeasureOptions()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AddPackFormValues>({
    resolver: zodResolver(addPackFormSchema),
    defaultValues: { packagingUnit: BARE_CONTAINER, packagingSize: '', vendorSku: '', lastCostPrice: '' },
  })

  const packagingUnit = watch('packagingUnit')
  const hasContainer = packagingUnit !== BARE_CONTAINER
  const packagingLabel = packagingOptions.find((o) => o.code === packagingUnit)?.label ?? packagingUnit
  const sizeNumber = Number(watch('packagingSize')) || 0
  const costNumber = Number(watch('lastCostPrice')) || 0

  // What this pack's cost is entered per — itself, when it names a container and a size; the
  // stock unit directly otherwise. Built as a UnitOption purely to reuse `toBasePrice`'s rounding
  // (§3.2, scale 6 HALF_UP) rather than re-deriving the arithmetic here.
  const costEntryOption: UnitOption = hasContainer
    ? { code: packagingUnit, label: packagingLabel, factorToStockUnit: sizeNumber || 1, isStockUnit: false, isDefault: false, isPack: true }
    : { code: '', label: stockUnit, factorToStockUnit: 1, isStockUnit: true, isDefault: true, isPack: false }
  const baseCost = costNumber > 0 ? toBasePrice(costNumber, costEntryOption) : null
  const costConverts = hasContainer && sizeNumber > 0

  async function onSubmit(values: AddPackFormValues) {
    setFormError(null)
    if (hasContainer && (!values.packagingSize.trim() || Number(values.packagingSize) <= 0)) {
      setFormError(`Enter how many ${stockUnit} one ${packagingLabel.toLowerCase()} holds.`)
      return
    }
    if (values.lastCostPrice.trim() && Number(values.lastCostPrice) < 0) {
      setFormError('Cost cannot be negative.')
      return
    }
    try {
      const pack = await productVendorsApi.addPack(productId, vendor.id, {
        packagingUnit: hasContainer ? packagingUnit : null,
        packagingSize: hasContainer ? Number(values.packagingSize) : null,
        vendorSku: values.vendorSku.trim() || undefined,
        lastCostPrice: values.lastCostPrice.trim() ? (baseCost ?? undefined) : undefined,
      })
      onSuccess(pack)
    } catch (err) {
      setFormError(isAppError(err) ? err.message : 'Could not add that pack. Please try again.')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Add pack — ${vendor.companyVendorName}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            Add
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <p className="text-sm text-neutral-500">
          A container this {UNIT_COPY.SUPPLIER.toLowerCase()} delivers in, or none at all if they price straight in{' '}
          {stockUnit}.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="add-pack-container" className="mb-1.5 block text-sm font-medium text-neutral-700">
              {UNIT_COPY.PACK}
            </label>
            <select
              id="add-pack-container"
              className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
              {...register('packagingUnit')}
            >
              <option value={BARE_CONTAINER}>No container — priced per {stockUnit}</option>
              {packagingOptions.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {hasContainer && (
            <TextField
              label={UNIT_COPY.UNITS_PER_PACK}
              inputMode="decimal"
              hint={`How many ${stockUnit} one ${packagingLabel.toLowerCase()} holds`}
              error={errors.packagingSize?.message}
              {...register('packagingSize')}
            />
          )}
        </div>

        <TextField
          label={`${UNIT_COPY.SUPPLIER_CODE} (optional)`}
          hint="Their own code for this specific pack — different bag sizes often carry different codes."
          error={errors.vendorSku?.message}
          {...register('vendorSku')}
        />

        <div>
          <TextField
            label={`Cost (₦ per ${hasContainer ? packagingLabel.toLowerCase() || 'pack' : stockUnit}, optional)`}
            inputMode="decimal"
            error={errors.lastCostPrice?.message}
            {...register('lastCostPrice')}
          />
          {costConverts && baseCost != null && (
            <p className="mt-1.5 text-xs text-neutral-500">{formatPriceEcho(baseCost, stockUnit)} stored</p>
          )}
        </div>

        <FormError message={formError} />
      </form>
    </Modal>
  )
}
