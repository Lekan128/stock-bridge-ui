import { z } from 'zod'
import { NIGERIAN_STATES } from '@/constants/nigerianStates'
import type { DeliveryAddress, DeliveryAddressPayload } from '@/features/addresses/types'

/**
 * Max lengths mirror the backend's `@Size` constraints exactly, so an over-long field is caught
 * before the round trip rather than coming back as a 400 with a field error.
 *
 * The phone rule is deliberately loose — digits, spaces and the usual punctuation — because
 * Nigerian numbers are written half a dozen ways (`0803…`, `+234 803…`, `234-803-…`) and a strict
 * pattern would reject valid contact numbers for no delivery benefit.
 */
const phonePattern = /^[\d+\-()\s]{7,50}$/

export const addressFormSchema = z.object({
  label: z.string().trim().min(1, 'Give this address a name, e.g. "Main warehouse"').max(100, 'Must be 100 characters or fewer'),
  contactName: z.string().trim().min(1, 'Who should the driver ask for?').max(255, 'Must be 255 characters or fewer'),
  contactPhone: z
    .string()
    .trim()
    .min(1, 'A phone number is required — drivers call ahead')
    .max(50, 'Must be 50 characters or fewer')
    .regex(phonePattern, 'Enter a valid phone number'),
  addressLine1: z.string().trim().min(1, 'Street address is required').max(255, 'Must be 255 characters or fewer'),
  addressLine2: z.string().trim().max(255, 'Must be 255 characters or fewer'),
  city: z.string().trim().min(1, 'City is required').max(100, 'Must be 100 characters or fewer'),
  state: z.string().trim().min(1, 'Select a state').refine(
    (value) => (NIGERIAN_STATES as readonly string[]).includes(value),
    'Select a state from the list',
  ),
  landmark: z.string().trim().max(255, 'Must be 255 characters or fewer'),
  deliveryNotes: z.string().trim().max(500, 'Must be 500 characters or fewer'),
  makeDefault: z.boolean(),
})

export type AddressFormValues = z.infer<typeof addressFormSchema>

export function addressFormDefaults(address?: DeliveryAddress): AddressFormValues {
  return {
    label: address?.label ?? '',
    contactName: address?.contactName ?? '',
    contactPhone: address?.contactPhone ?? '',
    addressLine1: address?.addressLine1 ?? '',
    addressLine2: address?.addressLine2 ?? '',
    city: address?.city ?? '',
    state: address?.state ?? '',
    landmark: address?.landmark ?? '',
    deliveryNotes: address?.deliveryNotes ?? '',
    // An address that is already the default must stay one: the backend treats `makeDefault:false`
    // as "leave it alone", but pre-ticking it keeps the checkbox honest about the current state.
    makeDefault: address?.isDefault ?? false,
  }
}

/** Empty optional strings become `undefined` so the server stores a null, not a blank string. */
export function toAddressPayload(values: AddressFormValues, branchId?: string): DeliveryAddressPayload {
  return {
    label: values.label,
    contactName: values.contactName,
    contactPhone: values.contactPhone,
    addressLine1: values.addressLine1,
    addressLine2: values.addressLine2 || undefined,
    city: values.city,
    state: values.state,
    landmark: values.landmark || undefined,
    deliveryNotes: values.deliveryNotes || undefined,
    branchId,
    makeDefault: values.makeDefault || undefined,
  }
}
