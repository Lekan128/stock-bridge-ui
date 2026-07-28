import { z } from 'zod'
import { NIGERIAN_STATES } from '@/constants/nigerianStates'
import type { DeliveryAddressPayload } from '@/features/checkout/types'

/**
 * The inline "deliver somewhere else" form.
 *
 * Limits mirror `DeliveryAddressRequest.java` exactly so the client rejects what the server would
 * have rejected, with a message on the right field instead of a form-level 400. The state list is
 * validated as an enum rather than free text — a typo'd state silently breaks delivery routing.
 */
const NIGERIAN_STATE_SET = new Set<string>(NIGERIAN_STATES)

export const addressFormSchema = z.object({
  label: z.string().trim().min(1, 'Give this address a name, e.g. “Main kitchen”').max(100, 'Must be 100 characters or fewer'),
  contactName: z.string().trim().min(1, 'Who should the driver ask for?').max(255, 'Must be 255 characters or fewer'),
  contactPhone: z
    .string()
    .trim()
    .min(1, 'A phone number is required for delivery')
    .max(50, 'Must be 50 characters or fewer')
    // Deliberately loose: Nigerian numbers are written 0801…, +234 801…, and with spaces or
    // dashes. Rejecting a real number the driver could call is far worse than accepting a format
    // we did not anticipate.
    .refine((value) => /\d{7,}/.test(value.replace(/\D/g, '')), 'Enter a valid phone number'),
  addressLine1: z.string().trim().min(1, 'Street address is required').max(255, 'Must be 255 characters or fewer'),
  addressLine2: z.string().trim().max(255, 'Must be 255 characters or fewer'),
  city: z.string().trim().min(1, 'City or town is required').max(100, 'Must be 100 characters or fewer'),
  state: z
    .string()
    .trim()
    .min(1, 'Select a state')
    .refine((value) => NIGERIAN_STATE_SET.has(value), 'Select a state from the list'),
  landmark: z.string().trim().max(255, 'Must be 255 characters or fewer'),
  deliveryNotes: z.string().trim().max(500, 'Must be 500 characters or fewer'),
  /** Persist to the address book. Forced on when the company has no address at all. */
  saveAddress: z.boolean(),
})

export type AddressFormValues = z.infer<typeof addressFormSchema>

export function addressFormDefaults(saveAddress = true): AddressFormValues {
  return {
    label: '',
    contactName: '',
    contactPhone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    landmark: '',
    deliveryNotes: '',
    saveAddress,
  }
}

/** Empty optional strings are dropped rather than sent as `""` — the server stores them as null. */
export function toAddressPayload(values: AddressFormValues, makeDefault?: boolean): DeliveryAddressPayload {
  const optional = (value: string) => (value.trim() === '' ? undefined : value.trim())
  return {
    label: values.label.trim(),
    contactName: values.contactName.trim(),
    contactPhone: values.contactPhone.trim(),
    addressLine1: values.addressLine1.trim(),
    addressLine2: optional(values.addressLine2),
    city: values.city.trim(),
    state: values.state.trim(),
    landmark: optional(values.landmark),
    deliveryNotes: optional(values.deliveryNotes),
    makeDefault,
  }
}
