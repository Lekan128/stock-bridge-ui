import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { TextField } from '@/components/TextField'
import { NIGERIAN_STATES } from '@/constants/nigerianStates'
import { addressFormDefaults, addressFormSchema, type AddressFormValues } from '@/features/checkout/schemas'

export interface NewAddressFormProps {
  /** Resolved values, already validated. The caller decides what to do with `saveAddress`. */
  onSubmit: (values: AddressFormValues) => void | Promise<void>
  onCancel?: () => void
  /**
   * The company has no saved address at all. Saving is then forced on (an unsaved first address
   * would leave the address book empty and make the next order start from scratch) and the
   * checkbox is replaced by an explanation.
   */
  forceSave?: boolean
  submitLabel?: string
  submitting?: boolean
  /** Server-side rejection (bad state, over-length field) to show above the buttons. */
  formError?: string | null
}

/**
 * The inline "deliver somewhere else" form.
 *
 * State is a `<select>` over `NIGERIAN_STATES` rather than a text input: the server validates
 * against the 36 states + FCT and a typo silently breaks delivery routing and the regional
 * analytics. Every input is labelled and errors are wired via `aria-describedby` by `TextField`.
 */
export function NewAddressForm({
  onSubmit,
  onCancel,
  forceSave = false,
  submitLabel = 'Use this address',
  submitting = false,
  formError,
}: NewAddressFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: addressFormDefaults(true),
  })

  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit({ ...values, saveAddress: forceSave || values.saveAddress }))}
      className="space-y-4"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Address name"
          placeholder="Main kitchen"
          error={errors.label?.message}
          hint="How your team will recognise it later."
          {...register('label')}
        />
        <TextField
          label="Contact name"
          placeholder="Ada Okafor"
          autoComplete="name"
          error={errors.contactName?.message}
          {...register('contactName')}
        />
      </div>

      <TextField
        label="Contact phone"
        type="tel"
        placeholder="+234 801 234 5678"
        autoComplete="tel"
        error={errors.contactPhone?.message}
        hint="The driver calls this number on arrival."
        {...register('contactPhone')}
      />

      <TextField
        label="Street address"
        placeholder="14 Adeola Odeku Street"
        autoComplete="address-line1"
        error={errors.addressLine1?.message}
        {...register('addressLine1')}
      />

      <TextField
        label="Apartment, floor, unit (optional)"
        placeholder="Second floor, rear entrance"
        autoComplete="address-line2"
        error={errors.addressLine2?.message}
        {...register('addressLine2')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="City or town"
          placeholder="Victoria Island"
          autoComplete="address-level2"
          error={errors.city?.message}
          {...register('city')}
        />
        <div>
          <label htmlFor="checkout-state" className="mb-1.5 block text-sm font-medium text-neutral-700">
            State
          </label>
          <select
            id="checkout-state"
            aria-invalid={!!errors.state || undefined}
            aria-describedby={errors.state ? 'checkout-state-error' : undefined}
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
            <p id="checkout-state-error" role="alert" className="mt-1.5 text-xs text-danger-600">
              {errors.state.message}
            </p>
          )}
        </div>
      </div>

      <TextField
        label="Landmark (optional)"
        placeholder="Opposite the Eko Hotel roundabout"
        error={errors.landmark?.message}
        {...register('landmark')}
      />

      <div>
        <label htmlFor="checkout-delivery-notes" className="mb-1.5 block text-sm font-medium text-neutral-700">
          Delivery instructions (optional)
        </label>
        <textarea
          id="checkout-delivery-notes"
          rows={2}
          placeholder="Deliveries accepted 8am – 4pm on weekdays. Trucks should use the side gate."
          aria-invalid={!!errors.deliveryNotes || undefined}
          className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          {...register('deliveryNotes')}
        />
        {errors.deliveryNotes && (
          <p role="alert" className="mt-1.5 text-xs text-danger-600">
            {errors.deliveryNotes.message}
          </p>
        )}
      </div>

      {forceSave ? (
        <p className="rounded-md bg-primary-50 px-3 py-2 text-xs text-primary-800">
          This will be saved as your company's default delivery address, so your next order starts here.
        </p>
      ) : (
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-neutral-700">
          <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded-sm accent-primary-600" {...register('saveAddress')} />
          <span>
            Save this address to our address book
            <span className="mt-0.5 block text-xs text-neutral-500">
              Anyone on your team can pick it at checkout next time.
            </span>
          </span>
        </label>
      )}

      <FormError message={formError ?? undefined} />

      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
