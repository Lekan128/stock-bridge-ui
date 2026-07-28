import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { Modal } from '@/components/Modal'
import { TextField } from '@/components/TextField'
import { NIGERIAN_STATES } from '@/constants/nigerianStates'
import { addressesApi } from '@/features/addresses/api/addressesApi'
import {
  addressFormDefaults,
  addressFormSchema,
  toAddressPayload,
  type AddressFormValues,
} from '@/features/addresses/schemas'
import type { DeliveryAddress } from '@/features/addresses/types'
import { isAppError } from '@/types/api'

export interface AddressFormModalProps {
  /** Omit to add a new address; pass one to edit it. */
  address?: DeliveryAddress
  /** True when this would be the company's first address — it then becomes the default whatever. */
  isFirstAddress: boolean
  onClose: () => void
  onSaved: (address: DeliveryAddress) => void
}

const FIELDS = new Set<keyof AddressFormValues>([
  'label',
  'contactName',
  'contactPhone',
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'landmark',
  'deliveryNotes',
])

/**
 * Add/edit an address. One modal for both, because the fields are identical and two near-copies
 * of a ten-field form drift within a week.
 *
 * `branchId` is carried through unchanged rather than exposed: branch management is deliberately
 * out of scope, so an address created against Head Office keeps that association when edited.
 */
export function AddressFormModal({ address, isFirstAddress, onClose, onSaved }: AddressFormModalProps) {
  const isEdit = !!address
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: addressFormDefaults(address),
  })

  async function onSubmit(values: AddressFormValues) {
    setFormError(null)
    // The first address is the default whether or not the box is ticked — a company with one
    // address and no default would fail checkout for a reason nobody could see.
    const payload = toAddressPayload(
      { ...values, makeDefault: values.makeDefault || (!isEdit && isFirstAddress) },
      address?.branchId,
    )

    try {
      const saved = isEdit && address ? await addressesApi.update(address.id, payload) : await addressesApi.create(payload)
      onSaved(saved)
    } catch (err: unknown) {
      if (!isAppError(err)) {
        setFormError('Something went wrong. Please try again.')
        return
      }
      let mappedAny = false
      for (const fieldError of err.errors ?? []) {
        if (fieldError.field && FIELDS.has(fieldError.field as keyof AddressFormValues)) {
          setError(fieldError.field as keyof AddressFormValues, { message: fieldError.message })
          mappedAny = true
        }
      }
      if (!mappedAny) setFormError(err.message)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit delivery address' : 'Add delivery address'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="address-form" loading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Add address'}
          </Button>
        </>
      }
    >
      <form id="address-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <TextField
          label="Name for this address"
          hint='Something you will recognise at checkout, e.g. "Ikeja warehouse".'
          error={errors.label?.message}
          {...register('label')}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Contact person" error={errors.contactName?.message} {...register('contactName')} />
          <TextField
            label="Contact phone"
            type="tel"
            inputMode="tel"
            hint="The driver calls this number on arrival."
            error={errors.contactPhone?.message}
            {...register('contactPhone')}
          />
        </div>

        <TextField label="Street address" error={errors.addressLine1?.message} {...register('addressLine1')} />
        <TextField
          label="Address line 2"
          placeholder="Optional"
          error={errors.addressLine2?.message}
          {...register('addressLine2')}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="City" error={errors.city?.message} {...register('city')} />
          <div>
            <label htmlFor="state" className="mb-1.5 block text-sm font-medium text-neutral-700">
              State
            </label>
            {/* A select, not free text: ProcurePal delivers within Nigeria only, and a typo'd
                state silently breaks delivery routing and skews the regional analytics. */}
            <select
              id="state"
              aria-invalid={!!errors.state || undefined}
              aria-describedby={errors.state ? 'state-error' : undefined}
              className={`w-full rounded-md border px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 ${
                errors.state
                  ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-100'
                  : 'border-neutral-200 focus:border-primary-500 focus:ring-primary-100'
              }`}
              {...register('state')}
            >
              <option value="">Select a state</option>
              {NIGERIAN_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
            {errors.state && (
              <p id="state-error" role="alert" className="mt-1.5 text-xs text-danger-600">
                {errors.state.message}
              </p>
            )}
          </div>
        </div>

        <TextField
          label="Landmark"
          placeholder="Optional — e.g. opposite the GTBank"
          hint="Nigerian addresses are often found by landmark, not by street number."
          error={errors.landmark?.message}
          {...register('landmark')}
        />

        <div>
          <label htmlFor="deliveryNotes" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Delivery notes <span className="font-normal text-neutral-400">(optional)</span>
          </label>
          <textarea
            id="deliveryNotes"
            rows={2}
            placeholder="e.g. deliveries accepted 8am–4pm, use the back gate"
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            {...register('deliveryNotes')}
          />
          {errors.deliveryNotes && (
            <p role="alert" className="mt-1.5 text-xs text-danger-600">
              {errors.deliveryNotes.message}
            </p>
          )}
        </div>

        {isFirstAddress && !isEdit ? (
          <p className="rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
            This is your first address, so it becomes your default delivery location.
          </p>
        ) : (
          <label className="flex items-start gap-2.5 text-sm text-neutral-700">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary-600"
              disabled={address?.isDefault}
              {...register('makeDefault')}
            />
            <span>
              Make this the default delivery address
              {address?.isDefault && <span className="block text-xs text-neutral-500">This is already your default.</span>}
            </span>
          </label>
        )}

        <FormError message={formError} />
      </form>
    </Modal>
  )
}
