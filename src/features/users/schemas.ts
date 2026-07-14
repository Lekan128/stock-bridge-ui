import { z } from 'zod'
import { USER_ROLES } from '@/features/users/types'

const roleSchema = z.enum(USER_ROLES)

export const createUserSchema = z
  .object({
    username: z.string().trim().min(1, 'Username is required'),
    password: z.string().min(8, 'Must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm the password'),
    role: roleSchema,
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type CreateUserFormValues = z.infer<typeof createUserSchema>

export function createUserFormDefaults(): CreateUserFormValues {
  return { username: '', password: '', confirmPassword: '', role: 'STAFF' }
}

export const editUserSchema = z.object({
  role: roleSchema,
  active: z.boolean(),
})

export type EditUserFormValues = z.infer<typeof editUserSchema>

export const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(8, 'Must be at least 8 characters'),
    confirmNewPassword: z.string().min(1, 'Please confirm the password'),
  })
  .refine((values) => values.newPassword === values.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
  })

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>

export function resetPasswordFormDefaults(): ResetPasswordFormValues {
  return { newPassword: '', confirmNewPassword: '' }
}
