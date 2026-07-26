import { z } from 'zod'

const emailField = z.string().email()

function isEmail(value: string): boolean {
  return emailField.safeParse(value).success
}

/**
 * Profile fields shared by the admin user forms and the self-service profile form.
 * Limits mirror the backend exactly; blank is allowed and stored as null server-side.
 */
export const profileFieldSchemas = {
  firstName: z.string().trim().max(100, 'Must be 100 characters or fewer'),
  lastName: z.string().trim().max(100, 'Must be 100 characters or fewer'),
  email: z
    .string()
    .trim()
    .max(255, 'Must be 255 characters or fewer')
    .refine((value) => value === '' || isEmail(value), 'Enter a valid email address'),
  phone: z.string().trim().max(50, 'Must be 50 characters or fewer'),
  jobTitle: z.string().trim().max(100, 'Must be 100 characters or fewer'),
}

// Role codes come from GET /api/roles, so the form only checks that one was picked.
const roleSchema = z.string().min(1, 'Select a role')

export const createUserSchema = z
  .object({
    username: z.string().trim().min(1, 'Username is required'),
    password: z.string().min(8, 'Must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm the password'),
    role: roleSchema,
    ...profileFieldSchemas,
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type CreateUserFormValues = z.infer<typeof createUserSchema>

export function createUserFormDefaults(): CreateUserFormValues {
  return {
    username: '',
    password: '',
    confirmPassword: '',
    role: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    jobTitle: '',
  }
}

export const editUserSchema = z.object({
  role: roleSchema,
  active: z.boolean(),
  ...profileFieldSchemas,
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
