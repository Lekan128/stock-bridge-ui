import { z } from 'zod'
import type { Company, UpdateCompanyPayload } from '@/features/company/types'

/** Limits mirror UpdateCompanyRequest exactly, so an over-long value never round-trips to a 400. */
export const companyDetailsSchema = z.object({
  name: z.string().trim().min(1, 'Company name is required').max(255, 'Must be 255 characters or fewer'),
  adminEmail: z
    .string()
    .trim()
    .min(1, 'Admin email is required')
    .max(255, 'Must be 255 characters or fewer')
    .email('Enter a valid email address'),
  // Length-only, matching the backend: Nigerian numbers get typed many ways and rejecting a
  // company's own phone number over formatting would be a self-inflicted wound.
  phone: z.string().trim().max(50, 'Must be 50 characters or fewer'),
})

export type CompanyDetailsFormValues = z.infer<typeof companyDetailsSchema>

export function companyDetailsDefaults(company?: Company | null): CompanyDetailsFormValues {
  return {
    name: company?.name ?? '',
    adminEmail: company?.adminEmail ?? '',
    phone: company?.phone ?? '',
  }
}

/** PUT /api/company replaces the record, so all three fields go on every submit; '' clears the phone. */
export function toUpdateCompanyPayload(values: CompanyDetailsFormValues): UpdateCompanyPayload {
  return {
    name: values.name.trim(),
    adminEmail: values.adminEmail.trim(),
    phone: values.phone.trim() === '' ? null : values.phone.trim(),
  }
}
