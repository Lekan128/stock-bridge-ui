import { zodResolver } from '@hookform/resolvers/zod'
import { CircleCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { signupSchema, type SignupFormValues } from '@/auth/schemas'
import { useAuth } from '@/auth/useAuth'
import { AuthCard } from '@/components/AuthCard'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { PasswordField } from '@/components/PasswordField'
import { TextField } from '@/components/TextField'
import { track } from '@/marketing/analytics'
import { FOUNDING_OFFER } from '@/marketing/config'
import { isAppError } from '@/types/api'
import { DEFAULT_AUTHENTICATED_PATH } from '@/utils/redirectTarget'
import { slugify } from '@/utils/slugify'
import { welcomeStorage } from '@/utils/storage'
import { normaliseWhatsApp } from '@/utils/whatsappNumber'

const KNOWN_FIELDS = new Set<keyof SignupFormValues>(['name', 'clientIdentifier', 'phone', 'adminEmail', 'password'])

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Sign-up (LANDING_PAGE_PLAN.md §4, step two: "the account, one field left").
 *
 * Arriving from the landing page's "Create your password", the business name and WhatsApp number
 * are already filled in (`?setup=&business=&whatsapp=`) and only the password is left. The Company
 * ID is generated from the name and shown, not asked for; the owner can change it. An email is
 * optional: the owner logs in with the phone number, or with the email if they add one.
 */
export function SignupPage() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [formError, setFormError] = useState<string | null>(null)

  const setupId = params.get('setup')
  const setupRequestId = setupId && UUID_PATTERN.test(setupId) ? setupId : undefined
  const fromSetup = setupRequestId != null
  const founding = params.get('offer') === 'founding'
  const prefilledName = params.get('business')?.slice(0, 120) ?? ''
  const prefilledPhone = params.get('whatsapp')?.slice(0, 24) ?? ''

  const [editingId, setEditingId] = useState(false)
  const [identifierEdited, setIdentifierEdited] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    setFocus,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: prefilledName,
      clientIdentifier: slugify(prefilledName),
      phone: prefilledPhone,
      adminEmail: '',
      password: '',
    },
  })

  const clientIdentifier = watch('clientIdentifier')

  async function onSubmit(values: SignupFormValues) {
    setFormError(null)
    try {
      const tenantUser = await signup({
        name: values.name,
        // Only a Company ID the owner chose is sent. A generated one is the server's to pick, so it
        // can add -2 when another shop already has the name instead of refusing.
        clientIdentifier: identifierEdited ? values.clientIdentifier || undefined : undefined,
        phone: normaliseWhatsApp(values.phone) ?? values.phone,
        adminEmail: values.adminEmail,
        password: values.password,
        setupRequestId,
      })
      // Lead to signup (plan §4, what we measure). Same visitor id as the landing page's events.
      track('signup_completed', { fromSetup, founding })
      welcomeStorage.set({
        clientIdentifier: tenantUser.clientIdentifier,
        username: tenantUser.username,
        phone: normaliseWhatsApp(values.phone) ?? undefined,
        fromSetup,
      })
      navigate(DEFAULT_AUTHENTICATED_PATH, { replace: true })
    } catch (err) {
      if (!isAppError(err)) {
        setFormError('Something went wrong. Please try again.')
        return
      }

      let mappedAny = false
      for (const fieldError of err.errors ?? []) {
        if (fieldError.field && KNOWN_FIELDS.has(fieldError.field as keyof SignupFormValues)) {
          setError(fieldError.field as keyof SignupFormValues, { message: fieldError.message })
          mappedAny = true
        }
      }
      if (mappedAny) return

      const lower = err.message.toLowerCase()
      if (lower.includes('identifier')) {
        setEditingId(true)
        setError('clientIdentifier', { message: 'Another business has this Company ID. Choose a different one.' })
        setFocus('clientIdentifier')
      } else if (lower.includes('whatsapp') || lower.includes('mobile number')) {
        setError('phone', { message: err.message })
      } else if (lower.includes('email')) {
        setError('adminEmail', { message: err.message })
      } else if (err.status === 400 && err.message === 'Something went wrong. Please try again.') {
        // A refusal with no reason (an API older than this form would answer a phone-only sign-up
        // this way): say what can be done instead of "something went wrong".
        setFormError(
          "We couldn't create the account with these details. Check them and try again, or WhatsApp us on +234 818 410 3312 and we'll set it up with you.",
        )
      } else {
        setFormError(err.message)
      }
    }
  }

  return (
    <AuthCard
      showcase
      title={fromSetup ? 'Create your password' : 'Create your account'}
      subtitle={
        fromSetup
          ? 'Your setup is booked. Set a password to see your stock as we load it.'
          : FOUNDING_OFFER
            ? 'Free for 12 months. No card.'
            : 'Free to start. No card.'
      }
      footer={
        <div className="flex flex-col gap-2">
          <span className="text-neutral-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary-600 hover:underline">
              Log in
            </Link>
          </span>
          {/* Deliberately NOT "Sign up as a vendor". This page creates a BUYING company account
              immediately; the vendor route creates nothing at all — it puts a business on a
              waitlist a super admin reviews by hand. Wording the two as sibling kinds of signup is
              what would make an applicant expect a login and then go looking for one that does not
              exist, which is the single most likely support ticket this feature can produce. */}
          {!fromSetup && (
            <span className="border-t border-neutral-100 pt-2 text-neutral-500">
              Want to sell on ProcurePal?{' '}
              <Link to="/vendor-application" className="font-medium text-primary-600 hover:underline">
                Apply to become a vendor
              </Link>
            </span>
          )}
        </div>
      }
    >
      {founding && (
        <ul className="mb-5 flex flex-col gap-1.5 rounded-md bg-primary-50 px-3 py-2.5 text-sm text-primary-900">
          {['Free for 12 months, every feature', 'We load your products within 24 hours', 'Then ₦5,000 a month for life'].map(
            (line) => (
              <li key={line} className="flex items-start gap-2">
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-700" aria-hidden="true" />
                {line}
              </li>
            ),
          )}
        </ul>
      )}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div>
          <TextField
            label="Business name"
            autoComplete="organization"
            error={errors.name?.message}
            {...register('name', {
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                if (!identifierEdited) {
                  setValue('clientIdentifier', slugify(e.target.value), { shouldValidate: editingId })
                }
              },
            })}
          />
          {!editingId && (
            <p className="mt-1.5 text-xs text-neutral-500">
              {clientIdentifier ? (
                <>
                  Your Company ID will be <span className="font-mono font-medium text-neutral-800">{clientIdentifier}</span>
                  . Your staff type it to log in.{' '}
                </>
              ) : (
                'Your Company ID is made from this name. Your staff type it to log in. '
              )}
              <button
                type="button"
                onClick={() => setEditingId(true)}
                className="font-medium text-primary-600 hover:underline"
              >
                Change
              </button>
            </p>
          )}
        </div>
        {editingId && (
          <TextField
            label="Company ID"
            hint="Your staff type this to log in. Lowercase letters, numbers and hyphens."
            autoFocus
            autoCapitalize="none"
            spellCheck={false}
            error={errors.clientIdentifier?.message}
            {...register('clientIdentifier', { onChange: () => setIdentifierEdited(true) })}
          />
        )}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          hint="Receipts and account messages come here. You can log in with it."
          error={errors.adminEmail?.message}
          {...register('adminEmail')}
        />
        <TextField
          label="WhatsApp number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0803 123 4567"
          hint="We message you here to load your products. You can log in with it too."
          error={errors.phone?.message}
          {...register('phone')}
        />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          hint="At least 8 characters."
          error={errors.password?.message}
          {...register('password')}
        />
        <FormError message={formError} />
        <Button type="submit" loading={isSubmitting} className="w-full">
          {fromSetup ? 'Create my account' : 'Create account'}
        </Button>
      </form>
    </AuthCard>
  )
}
