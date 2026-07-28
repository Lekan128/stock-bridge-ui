import { z } from 'zod'
import type { SuperAdminClientDetail, UpdateClientPayload } from '@/features/admin/types'

/** Same shape ClientSignupService.slugify produces, and the same one the backend re-checks. */
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

/**
 * PUT /api/superadmin/clients/{id}. Limits mirror UpdateClientRequest exactly.
 *
 * `renameSlug` is a form-only field with no counterpart on the wire. It exists so a rename is
 * something an ops user opts into rather than something a pre-filled input can do by accident:
 * with it off, `slug` is left out of the payload entirely, which the backend reads as "do not
 * rename". See EditClientModal for what a rename actually costs.
 */
export const editClientSchema = z
  .object({
    name: z.string().trim().min(1, 'Company name is required').max(255, 'Must be 255 characters or fewer'),
    adminEmail: z
      .string()
      .trim()
      .min(1, 'Admin email is required')
      .max(255, 'Must be 255 characters or fewer')
      .email('Enter a valid email address'),
    phone: z.string().trim().max(50, 'Must be 50 characters or fewer'),
    paymentTerms: z.enum(['PREPAID', 'PAY_ON_DELIVERY_ALLOWED']),
    renameSlug: z.boolean(),
    slug: z.string().trim().max(100, 'Must be 100 characters or fewer'),
  })
  .superRefine((values, ctx) => {
    if (!values.renameSlug) return
    if (values.slug === '') {
      ctx.addIssue({ code: 'custom', path: ['slug'], message: 'Enter the new login identifier' })
      return
    }
    if (!SLUG_PATTERN.test(values.slug)) {
      ctx.addIssue({
        code: 'custom',
        path: ['slug'],
        message: 'Use lowercase letters, numbers, and single hyphens between them',
      })
    }
  })

export type EditClientFormValues = z.infer<typeof editClientSchema>

export function editClientDefaults(client: SuperAdminClientDetail): EditClientFormValues {
  return {
    name: client.name,
    adminEmail: client.adminEmail,
    phone: client.phone ?? '',
    paymentTerms: client.paymentTerms,
    // Always starts off: the common edit is a typo in a display name, and that must never be
    // able to log a whole company out.
    renameSlug: false,
    slug: client.slug,
  }
}

export function toUpdateClientPayload(values: EditClientFormValues): UpdateClientPayload {
  return {
    name: values.name.trim(),
    adminEmail: values.adminEmail.trim(),
    phone: values.phone.trim() === '' ? null : values.phone.trim(),
    paymentTerms: values.paymentTerms,
    // Omitted, not nulled, unless a rename was deliberately requested.
    ...(values.renameSlug ? { slug: values.slug.trim() } : {}),
  }
}
