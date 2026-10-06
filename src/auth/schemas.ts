import { normaliseWhatsApp } from '@/utils/whatsappNumber'
import { z } from 'zod'

export const loginSchema = z.object({
  clientIdentifier: z.string().trim().min(1, 'Company ID is required'),
  username: z.string().trim().min(1, 'Enter your phone number, email or username'),
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

/**
 * Signup (LANDING_PAGE_PLAN.md §4, and the owners' decision of 2026-10-06 that the email is
 * required): business name, email, WhatsApp number and a password, shown rather than typed twice.
 * The Company ID is generated from the name unless the owner changes it. The owner logs in with
 * the email or the WhatsApp number.
 */
export const signupSchema = z.object({
  name: z.string().trim().min(1, 'Enter your business name'),
  clientIdentifier: z
    .string()
    .trim()
    .max(63, 'Must be 63 characters or fewer')
    .refine((value) => value === '' || SLUG_PATTERN.test(value), {
      message: 'Use lowercase letters, numbers, and hyphens only',
    }),
  adminEmail: z.string().trim().min(1, 'Enter your email address').email('Enter a valid email address'),
  phone: z
    .string()
    .trim()
    .min(1, 'Enter your WhatsApp number')
    .refine((value) => normaliseWhatsApp(value) != null, { message: 'Enter a Nigerian mobile number, like 0803 123 4567' }),
  password: z.string().min(8, 'Use at least 8 characters'),
})

export type SignupFormValues = z.infer<typeof signupSchema>

/** Self-service password reset, step 1 (PASSWORD_RESET_PLAN.md): the email to send the link to. */
export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address').email('Enter a valid email address'),
})

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>

/** Step 2: the new password. The same 8-character rule and wording as sign-up. */
export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Use at least 8 characters'),
})

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>
