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
 * Signup since the landing page's step 4 (LANDING_PAGE_PLAN.md §4): business name, WhatsApp number
 * and a password, shown rather than typed twice. The Company ID is generated from the name unless
 * the owner changes it, and an email is optional (the owner then logs in with the phone number).
 */
export const signupSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter your business name'),
    clientIdentifier: z
      .string()
      .trim()
      .max(63, 'Must be 63 characters or fewer')
      .refine((value) => value === '' || SLUG_PATTERN.test(value), {
        message: 'Use lowercase letters, numbers, and hyphens only',
      }),
    phone: z.string().trim(),
    adminEmail: z.string().trim().refine((value) => value === '' || z.string().email().safeParse(value).success, {
      message: 'Enter a valid email address',
    }),
    password: z.string().min(8, 'Use at least 8 characters'),
  })
  .superRefine((data, ctx) => {
    if (data.phone === '' && data.adminEmail === '') {
      ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Enter your WhatsApp number' })
    } else if (data.phone !== '' && normaliseWhatsApp(data.phone) == null) {
      ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Enter a Nigerian mobile number, like 0803 123 4567' })
    }
  })

export type SignupFormValues = z.infer<typeof signupSchema>
