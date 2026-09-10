import { z } from 'zod'
import { NIGERIAN_STATES } from '@/constants/nigerianStates'
import type { CompanyVendor, CompanyVendorPayload } from '@/features/vendors/types'

/**
 * The EXTERNAL vendor form.
 *
 * Max lengths mirror the backend's `@Size` constraints (and the column widths) exactly, so an
 * over-long field is caught before the round trip rather than coming back as a 400.
 *
 * The phone rule is the same deliberately-loose one the address form uses: Nigerian numbers are
 * written half a dozen ways (`0803…`, `+234 803…`, `234-803-…`) and a strict pattern would reject
 * valid contact numbers for no benefit.
 */
const phonePattern = /^[\d+\-()\s]{7,50}$/

export const vendorFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'What is this supplier called?')
    .max(255, 'Must be 255 characters or fewer'),
  // Required, matching the backend and `chk_company_vendors_external_shape`. A supplier you typed
  // in with no way to reach them is a note, not a directory entry — and unlike a marketplace
  // seller there is no account elsewhere holding their real number.
  contactPhone: z
    .string()
    .trim()
    .min(1, 'A contact number is required — this is how you reach them')
    .max(50, 'Must be 50 characters or fewer')
    .regex(phonePattern, 'Enter a valid phone number'),
  email: z
    .string()
    .trim()
    .max(255, 'Must be 255 characters or fewer')
    .refine((v) => v === '' || z.email().safeParse(v).success, 'Enter a valid email address'),
  addressLine1: z.string().trim().max(255, 'Must be 255 characters or fewer'),
  addressLine2: z.string().trim().max(255, 'Must be 255 characters or fewer'),
  city: z.string().trim().max(100, 'Must be 100 characters or fewer'),
  // Optional here where the delivery-address form requires it: ProcurePaddy has to deliver to an
  // address, but nobody has to know where their diesel supplier's office is. When it *is* given it
  // must be a real state — the server checks the same list.
  state: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || (NIGERIAN_STATES as readonly string[]).includes(value),
      'Select a state from the list',
    ),
  notes: z.string().trim().max(1000, 'Must be 1000 characters or fewer'),
})

export type VendorFormValues = z.infer<typeof vendorFormSchema>

export function vendorFormDefaults(vendor?: CompanyVendor): VendorFormValues {
  return {
    name: vendor?.name ?? '',
    contactPhone: vendor?.contactPhone ?? '',
    email: vendor?.email ?? '',
    addressLine1: vendor?.addressLine1 ?? '',
    addressLine2: vendor?.addressLine2 ?? '',
    city: vendor?.city ?? '',
    state: vendor?.state ?? '',
    notes: vendor?.notes ?? '',
  }
}

/** Empty optional strings become `undefined` so the server stores a null, not a blank string. */
export function toVendorPayload(values: VendorFormValues): CompanyVendorPayload {
  return {
    name: values.name,
    contactPhone: values.contactPhone,
    email: values.email || undefined,
    addressLine1: values.addressLine1 || undefined,
    addressLine2: values.addressLine2 || undefined,
    city: values.city || undefined,
    state: values.state || undefined,
    notes: values.notes || undefined,
  }
}
