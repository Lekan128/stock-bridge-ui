import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { Modal } from '@/components/Modal'
import { TextField } from '@/components/TextField'
import { productVendorsApi } from '@/features/products/api/productVendorsApi'
import { priceTierFormSchema, type PriceTierFormValues } from '@/features/products/vendors/schemas'
import type { ProductVendor, ProductVendorPriceTier } from '@/features/products/vendors/types'
import { isAppError } from '@/types/api'

export interface AddPriceTierModalProps {
  productId: string
  vendor: ProductVendor
  /** Label for whatever unit this form's quantity field is entered in — the vendor's configured
   *  packaging unit ("bag") when it has one, otherwise the product's base unit ("kg"). */
  unitLabel: string
  /** Multiplies the entered quantity to reach the product's base unit, per §5.1a: a vendor with
   *  `defaultPackagingUnit`/`defaultPackagingSize` set (e.g. "Bag" of 50) has `conversionFactor:
   *  50`, so "10 bags" saves as `minQuantity: 500`. `1` when the vendor has no packaging
   *  configured — the field is already in base units and needs no conversion. */
  conversionFactor: number
  /** The product's base unit label ("kg") — used only to render a live "= X kg" conversion
   *  preview beneath the quantity field when `conversionFactor !== 1`, so the packaging→base-unit
   *  conversion that happens silently at submit isn't invisible while filling the form. */
  baseUnitLabel: string
  onClose: () => void
  onSuccess: (tier: ProductVendorPriceTier) => void
}

/**
 * "+ Add price break" — a small, deliberately minimal form (two fields), not a full page, because
 * most vendors will only ever get zero or one of these. See §5.1a: the quantity is entered in the
 * vendor's own packaging unit so nobody filling this in has to think in the product's base unit,
 * and is converted to base units only at submit time — the one place this design doc is explicit
 * a broken conversion would be a real defect.
 */
export function AddPriceTierModal({
  productId,
  vendor,
  unitLabel,
  conversionFactor,
  baseUnitLabel,
  onClose,
  onSuccess,
}: AddPriceTierModalProps) {
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PriceTierFormValues>({
    resolver: zodResolver(priceTierFormSchema),
    defaultValues: { minQuantity: '', unitPrice: '' },
  })

  // Live preview of the conversion that happens silently at submit — only shown when there's an
  // actual conversion to explain (a vendor with no packaging configured has conversionFactor 1,
  // i.e. unitLabel already IS the base unit, so there's nothing to preview).
  const minQuantityNumber = Number(watch('minQuantity')) || 0
  const showConversion = conversionFactor !== 1 && minQuantityNumber > 0

  async function onSubmit(values: PriceTierFormValues) {
    setFormError(null)
    try {
      const tier = await productVendorsApi.addPriceTier(productId, vendor.id, {
        minQuantity: Number(values.minQuantity) * conversionFactor,
        unitPrice: Number(values.unitPrice),
      })
      onSuccess(tier)
    } catch (err) {
      setFormError(isAppError(err) ? err.message : 'Could not add that price break. Please try again.')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Add price break — ${vendor.companyVendorName}`}
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
          The price this vendor charges once an order reaches this quantity. Quantities are inclusive — a
          break entered as 10 applies at 10 {unitLabel} and above.
        </p>
        <div>
          <TextField
            label={`Minimum quantity (${unitLabel})`}
            inputMode="decimal"
            error={errors.minQuantity?.message}
            {...register('minQuantity')}
          />
          {showConversion && (
            <p className="mt-1.5 text-xs text-neutral-500">
              = {minQuantityNumber * conversionFactor} {baseUnitLabel}
            </p>
          )}
        </div>
        <TextField
          label={`Unit price (₦ per ${unitLabel})`}
          inputMode="decimal"
          error={errors.unitPrice?.message}
          {...register('unitPrice')}
        />
        <FormError message={formError} />
      </form>
    </Modal>
  )
}
