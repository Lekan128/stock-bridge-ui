import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { AuthCard } from '@/components/AuthCard'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { TextField } from '@/components/TextField'
import { vendorWaitlistApi } from '@/features/vendorWaitlist/api/vendorWaitlistApi'
import {
  vendorApplicationSchema,
  type VendorApplicationFormValues,
} from '@/features/vendorWaitlist/schemas'
import { isAppError } from '@/types/api'

/**
 * The fields the server can name in a validation message. The API answers with one sentence
 * produced by `ValidationErrors.describe`, which prefixes the offending field name — so matching
 * on that name is how a message lands under the right input instead of at the top of the form.
 * SignupPage does the same thing for its own fields.
 */
const SERVER_FIELDS: (keyof VendorApplicationFormValues)[] = [
  'businessName',
  'email',
  'contactPhone',
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'notes',
]

/**
 * The public "apply to sell on Procure Paddy" form — route `/vendor-application`.
 *
 * <h2>This page must never read as a signup</h2>
 * It is the single most likely source of confusion in the whole vendor feature: a business fills
 * in a form on a site that also has a "Create your account" page, and then tries to log in with
 * what they typed. There is nothing to log into — the API creates a
 * `vendor_waitlist_applications` row and no account whatsoever, and an account only exists if a
 * super admin later approves them and sends credentials.
 *
 * So the word "waitlist" appears in the heading, in the success state and in the acknowledgement
 * email, the submit button says "Submit application" rather than anything account-shaped, and the
 * success state says in as many words that there is nothing to sign in to yet. The stakeholder was
 * explicit that this is not "sign up as a vendor", and the copy follows that beyond just the link
 * label.
 *
 * <h2>Why the success state replaces the form rather than toasting</h2>
 * A toast over a form that is still on screen invites a second submission — and a second
 * submission is a real row, because there is deliberately no unique index on the applicant's email
 * (a rejected business reapplying with better information is a case the schema was designed for).
 * Replacing the card makes "done" unambiguous and leaves nothing to click twice.
 *
 * <h2>The 429</h2>
 * The endpoint is rate limited per source address and per submitted email. The refusal is
 * deliberately vague server-side — one message for both budgets, so that a 429 cannot answer "has
 * this address applied recently" — so this page repeats it as given rather than guessing which
 * limit was hit. `retryAfterSeconds` is a hint and may be absent: `Retry-After` is not a
 * CORS-safelisted response header, so a cross-origin caller only sees it if the API exposes it.
 */
export function VendorApplicationPage() {
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<VendorApplicationFormValues>({
    resolver: zodResolver(vendorApplicationSchema),
    defaultValues: {
      businessName: '',
      email: '',
      contactPhone: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      notes: '',
    },
  })

  async function onSubmit(values: VendorApplicationFormValues) {
    setFormError(null)
    try {
      await vendorWaitlistApi.apply({
        businessName: values.businessName,
        email: values.email,
        contactPhone: values.contactPhone,
        // Blank is how a form says "empty"; the API stores NULL. Sending "" would write empty
        // strings into columns a reviewer reads as "they left this out".
        addressLine1: values.addressLine1 || undefined,
        addressLine2: values.addressLine2 || undefined,
        city: values.city || undefined,
        state: values.state || undefined,
        notes: values.notes || undefined,
      })
      setSubmitted(true)
    } catch (err) {
      if (!isAppError(err)) {
        setFormError('Something went wrong. Please try again.')
        return
      }

      // Structured field errors first, if the server ever sends them.
      let mappedAny = false
      for (const fieldError of err.errors ?? []) {
        const field = fieldError.field as keyof VendorApplicationFormValues | undefined
        if (field && SERVER_FIELDS.includes(field)) {
          setError(field, { message: fieldError.message })
          mappedAny = true
        }
      }
      if (mappedAny) return

      // Otherwise fall back to matching the field name the message is prefixed with.
      const matched = SERVER_FIELDS.find((field) => err.message.startsWith(field))
      if (matched) {
        setError(matched, { message: err.message })
        return
      }

      setFormError(err.message)
    }
  }

  if (submitted) {
    return (
      <AuthCard
        title="You're on the waitlist"
        footer={
          <span className="text-neutral-500">
            <Link to="/" className="font-medium text-primary-600 hover:underline">
              Back to Procure Paddy
            </Link>
          </span>
        }
      >
        <div className="flex flex-col items-center text-center">
          <CheckCircle2 className="h-10 w-10 text-primary-600" aria-hidden="true" />
          <p className="mt-4 text-sm text-neutral-600">
            Thanks — we have your application and a confirmation is on its way to your inbox.
            Someone on our team reads every application, and we will email you either way.
          </p>
          {/* The sentence this page exists for. Said plainly, and said last so it is what the
              reader leaves with. */}
          <p className="mt-4 rounded-md bg-primary-50 px-3 py-2 text-sm text-primary-800">
            This is a waitlist, not an account — there is nothing to sign in to yet. If we approve
            you, we will send your login details in a separate email.
          </p>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Apply to sell on Procure Paddy"
      subtitle="Tell us about your business and our team will be in touch."
      footer={
        <span className="text-neutral-500">
          Already selling with us?{' '}
          <Link to="/login" className="font-medium text-primary-600 hover:underline">
            Log in
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <TextField
          label="Business name"
          autoComplete="organization"
          error={errors.businessName?.message}
          {...register('businessName')}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          hint="Where we will send our decision."
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Contact number"
          type="tel"
          autoComplete="tel"
          error={errors.contactPhone?.message}
          {...register('contactPhone')}
        />

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-1.5 text-sm font-medium text-neutral-700">
            Business address <span className="font-normal text-neutral-400">(optional)</span>
          </legend>
          <TextField
            label="Address line 1"
            autoComplete="address-line1"
            error={errors.addressLine1?.message}
            {...register('addressLine1')}
          />
          <TextField
            label="Address line 2"
            autoComplete="address-line2"
            error={errors.addressLine2?.message}
            {...register('addressLine2')}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="City"
              autoComplete="address-level2"
              error={errors.city?.message}
              {...register('city')}
            />
            <TextField
              label="State"
              autoComplete="address-level1"
              error={errors.state?.message}
              {...register('state')}
            />
          </div>
        </fieldset>

        <div>
          <label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-neutral-700">
            What do you sell? <span className="font-normal text-neutral-400">(optional)</span>
          </label>
          <textarea
            id="notes"
            rows={3}
            maxLength={1000}
            placeholder="Tell us about your products, where you operate, and anything else we should know."
            aria-invalid={!!errors.notes?.message || undefined}
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            {...register('notes')}
          />
          {errors.notes?.message && (
            <p role="alert" className="mt-1.5 text-xs text-danger-600">
              {errors.notes.message}
            </p>
          )}
        </div>

        <FormError message={formError} />
        <Button type="submit" loading={isSubmitting} className="w-full">
          Submit application
        </Button>
        {/* Set expectations before the click, not only after it, so nobody submits believing they
            are creating a login. */}
        <p className="text-center text-xs text-neutral-500">
          This adds you to our vendor waitlist. It does not create an account.
        </p>
      </form>
    </AuthCard>
  )
}
