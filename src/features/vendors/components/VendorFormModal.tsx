import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { Modal } from '@/components/Modal'
import { TextField } from '@/components/TextField'
import { NIGERIAN_STATES } from '@/constants/nigerianStates'
import { vendorsApi } from '@/features/vendors/api/vendorsApi'
import {
  toVendorPayload,
  vendorFormDefaults,
  vendorFormSchema,
  type VendorFormValues,
} from '@/features/vendors/schemas'
import type { CompanyVendor } from '@/features/vendors/types'
import { isAppError } from '@/types/api'

export interface VendorFormModalProps {
  /**
   * Omit to add a supplier; pass one to edit it. A VERIFIED vendor must never be passed here —
   * the server refuses the edit with a 409, and the list only offers the pencil on rows whose
   * `editable` flag is true.
   */
  vendor?: CompanyVendor
  onClose: () => void
  onSaved: (vendor: CompanyVendor) => void
}

const FIELDS = new Set<keyof VendorFormValues>([
  'name',
  'contactPhone',
  'email',
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'notes',
])

/**
 * Add/edit a supplier the company deals with off-platform. One modal for both, because the fields
 * are identical and two near-copies of an eight-field form drift within a week — the same call the
 * address form made.
 *
 * There is no "kind" control anywhere in here, and that is the point: this form creates EXTERNAL
 * entries and nothing else. VERIFIED ones are written by the server when a real purchase happens,
 * so offering the choice would be offering a lie the server would then refuse.
 */
export function VendorFormModal({ vendor, onClose, onSaved }: VendorFormModalProps) {
  const isEdit = !!vendor
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: vendorFormDefaults(vendor),
  })

  async function onSubmit(values: VendorFormValues) {
    setFormError(null)
    const payload = toVendorPayload(values)

    try {
      const saved = isEdit && vendor ? await vendorsApi.update(vendor.id, payload) : await vendorsApi.create(payload)
      onSaved(saved)
    } catch (err: unknown) {
      if (!isAppError(err)) {
        setFormError('Something went wrong. Please try again.')
        return
      }
      let mappedAny = false
      for (const fieldError of err.errors ?? []) {
        if (fieldError.field && FIELDS.has(fieldError.field as keyof VendorFormValues)) {
          setError(fieldError.field as keyof VendorFormValues, { message: fieldError.message })
          mappedAny = true
        }
      }
      // Covers the 409 for a VERIFIED row too. The UI should never get here — the pencil is not
      // offered on those — but if it did, the server's own sentence explains it better than
      // anything this component could invent.
      if (!mappedAny) setFormError(err.message)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit supplier' : 'Add supplier'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="vendor-form" loading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Add supplier'}
          </Button>
        </>
      }
    >
      <form id="vendor-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <p className="rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
          For suppliers you deal with outside ProcurePaddy. Sellers you buy from on the marketplace are
          added to this directory automatically.
        </p>

        <TextField
          label="Supplier name"
          hint="Their business name, as you would write it on an invoice."
          error={errors.name?.message}
          {...register('name')}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Contact number"
            type="tel"
            inputMode="tel"
            hint="Required — this is how you reach them."
            error={errors.contactPhone?.message}
            {...register('contactPhone')}
          />
          <TextField
            label="Email"
            type="email"
            placeholder="Optional"
            error={errors.email?.message}
            {...register('email')}
          />
        </div>

        <TextField
          label="Address"
          placeholder="Optional"
          error={errors.addressLine1?.message}
          {...register('addressLine1')}
        />
        <TextField
          label="Address line 2"
          placeholder="Optional"
          error={errors.addressLine2?.message}
          {...register('addressLine2')}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="City" placeholder="Optional" error={errors.city?.message} {...register('city')} />
          <div>
            <label htmlFor="state" className="mb-1.5 block text-sm font-medium text-neutral-700">
              State <span className="font-normal text-neutral-400">(optional)</span>
            </label>
            {/* A select rather than free text, and validated server-side against the same list —
                for the reason the address form gives: a select is a convenience, not a guarantee. */}
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
              <option value="">No state</option>
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

        <div>
          <label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Notes <span className="font-normal text-neutral-400">(optional)</span>
          </label>
          <textarea
            id="notes"
            rows={3}
            placeholder="e.g. delivers on Tuesdays, ask for Chidi, wants payment on delivery"
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            {...register('notes')}
          />
          {/* Stated because people assume otherwise about anything typed into a marketplace. */}
          <p className="mt-1.5 text-xs text-neutral-500">Only your company can see this. The supplier never does.</p>
          {errors.notes && (
            <p role="alert" className="mt-1.5 text-xs text-danger-600">
              {errors.notes.message}
            </p>
          )}
        </div>

        <FormError message={formError} />
      </form>
    </Modal>
  )
}
