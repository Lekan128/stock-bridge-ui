import { z } from 'zod'

/**
 * Mirrors the backend's VendorWaitlistApplicationRequest field for field, including its max
 * lengths — those match the columns in `V11__vendors.sql`, and a value this form accepted but the
 * database truncated would tell the applicant something different from what was stored.
 *
 * <h2>Three required, the rest optional, and that split is the product decision</h2>
 * A reviewer needs to look the business up and then reach a human about it. The name answers the
 * first; the email and phone answer the second, and both are required because a reviewer who can
 * only email gets no answer from a shopfront that lives on WhatsApp, and one who can only call has
 * nowhere to send the outcome. Everything else is optional so that an applicant who does not have
 * it to hand still reaches a person, who can ask.
 *
 * The phone is length-only on purpose, matching the backend: Nigerian numbers get typed as
 * 0803…, +234 803…, with spaces and with dashes, and rejecting a sales lead over a phone format
 * would be a self-inflicted wound.
 */
export const vendorApplicationSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(1, 'Business name is required')
    .max(255, 'Must be 255 characters or fewer'),
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Enter a valid email address')
    .max(255, 'Must be 255 characters or fewer'),
  contactPhone: z
    .string()
    .trim()
    .min(1, 'Contact number is required')
    .max(50, 'Must be 50 characters or fewer'),
  addressLine1: z.string().trim().max(255, 'Must be 255 characters or fewer'),
  addressLine2: z.string().trim().max(255, 'Must be 255 characters or fewer'),
  city: z.string().trim().max(100, 'Must be 100 characters or fewer'),
  state: z.string().trim().max(100, 'Must be 100 characters or fewer'),
  notes: z.string().trim().max(1000, 'Must be 1000 characters or fewer'),
})

export type VendorApplicationFormValues = z.infer<typeof vendorApplicationSchema>
