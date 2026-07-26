import { z } from 'zod'
import { profileFieldSchemas } from '@/features/users/schemas'
import type { Profile, UpdateProfilePayload } from '@/features/profile/types'

export const profileDetailsSchema = z.object({ ...profileFieldSchemas })

export type ProfileDetailsFormValues = z.infer<typeof profileDetailsSchema>

/** Absent fields are omitted from the JSON, so everything falls back to '' for controlled inputs. */
export function profileDetailsDefaults(profile?: Profile | null): ProfileDetailsFormValues {
  return {
    firstName: profile?.firstName ?? '',
    lastName: profile?.lastName ?? '',
    email: profile?.email ?? '',
    phone: profile?.phone ?? '',
    jobTitle: profile?.jobTitle ?? '',
  }
}

/** PUT /api/me replaces the whole profile, so all five fields go on every submit; '' means clear. */
export function toUpdateProfilePayload(values: ProfileDetailsFormValues): UpdateProfilePayload {
  const nullable = (value: string) => (value.trim() === '' ? null : value.trim())
  return {
    firstName: nullable(values.firstName),
    lastName: nullable(values.lastName),
    email: nullable(values.email),
    phone: nullable(values.phone),
    jobTitle: nullable(values.jobTitle),
  }
}

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Must be at least 8 characters'),
    confirmNewPassword: z.string().min(1, 'Please confirm the new password'),
  })
  .refine((values) => values.newPassword === values.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
  })

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>

export function changePasswordDefaults(): ChangePasswordFormValues {
  return { currentPassword: '', newPassword: '', confirmNewPassword: '' }
}
