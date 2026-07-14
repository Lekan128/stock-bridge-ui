import { z } from 'zod'

export const loginSchema = z.object({
  clientIdentifier: z.string().trim().min(1, 'Client ID is required'),
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginFormValues = z.infer<typeof loginSchema>

export const superAdminLoginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

export type SuperAdminLoginFormValues = z.infer<typeof superAdminLoginSchema>

// Mirrors the backend's slug format expectations for ClientSignupRequest.clientIdentifier.
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

export const signupSchema = z
  .object({
    name: z.string().trim().min(1, 'Company name is required'),
    clientIdentifier: z
      .string()
      .trim()
      .max(63, 'Must be 63 characters or fewer')
      .refine((value) => value === '' || SLUG_PATTERN.test(value), {
        message: 'Use lowercase letters, numbers, and hyphens only',
      }),
    adminEmail: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
    password: z.string().min(8, 'Must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type SignupFormValues = z.infer<typeof signupSchema>
