import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '@/api/authApi'
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '@/auth/schemas'
import { AuthCard } from '@/components/AuthCard'
import { Button, buttonClassName } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { TextField } from '@/components/TextField'
import { isAppError } from '@/types/api'

/** Seconds before "Send it again" can be pressed again. The server also rate-limits. */
const RESEND_COOLDOWN_SECONDS = 60

const UNREACHABLE_MESSAGE = "We couldn't send the link. Check your connection and try again."

/** The server's 429 copy when it gives one; otherwise ours. Never a status code. */
function sendErrorMessage(err: unknown): string {
  if (isAppError(err) && err.status === 429 && err.message) return err.message
  if (isAppError(err) && err.status === 400) return 'Enter a valid email address'
  return UNREACHABLE_MESSAGE
}

/**
 * `/forgot-password` — step 1 of self-service password reset (PASSWORD_RESET_PLAN.md, screen 2).
 *
 * One field. After sending, the same card changes to "Check your email" rather than navigating:
 * the person stays where they are and can send it again or fix a typo without starting over.
 *
 * The confirmation never says "we've sent you an email". The API answers the same way whether or
 * not the address has an account (so this page cannot be used to find out who is a customer), and
 * the copy is honest about that rather than promising a delivery it cannot know about.
 */
export function ForgotPasswordPage() {
  const [searchParams] = useSearchParams()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    // Carried over from the login form when its "Phone, email or username" field held an email.
    defaultValues: { email: searchParams.get('email') ?? '' },
  })

  async function onSubmit(values: ForgotPasswordFormValues) {
    setFormError(null)
    try {
      await authApi.requestPasswordReset(values.email.trim())
      setSentTo(values.email.trim())
    } catch (err) {
      setFormError(sendErrorMessage(err))
    }
  }

  if (sentTo) {
    return (
      <SentState
        email={sentTo}
        onUseDifferentEmail={() => {
          setSentTo(null)
          setFormError(null)
        }}
      />
    )
  }

  return (
    <AuthCard
      showcase
      title="Reset your password"
      subtitle="Enter the email you log in with or that's on your account. We'll send you a link to set a new password."
      footer={
        <div className="flex flex-col gap-2">
          <span className="text-neutral-500">
            Remembered it?{' '}
            <Link to="/login" className="font-medium text-primary-600 hover:underline">
              Log in
            </Link>
          </span>
          {/* The only honest answer for someone whose login is a phone number or a username. */}
          <span className="text-xs text-neutral-500">
            No email on your account? Ask your company's admin to reset it for you.
          </span>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <TextField
          label="Email address"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          error={errors.email?.message}
          {...register('email')}
        />
        <FormError message={formError} />
        <Button type="submit" loading={isSubmitting} className="w-full">
          Send reset link
        </Button>
      </form>
    </AuthCard>
  )
}

/** "Check your email" — the same card, new contents; no card inside it. */
function SentState({ email, onUseDifferentEmail }: { email: string; onUseDifferentEmail: () => void }) {
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS)
  const [resending, setResending] = useState(false)
  const [resendNote, setResendNote] = useState<string | null>(null)
  const [resendError, setResendError] = useState<string | null>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  async function resend() {
    setResending(true)
    setResendError(null)
    setResendNote(null)
    try {
      await authApi.requestPasswordReset(email)
      setResendNote('Sent again. Only the newest link works.')
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      setResendError(sendErrorMessage(err))
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthCard showcase title="Check your email">
      {/* Replaces the form with no navigation, so it is announced. */}
      <div role="status" className="flex flex-col gap-4 text-center text-sm text-neutral-600">
        <p>
          If an account uses
          <span className="block font-medium [overflow-wrap:anywhere] text-neutral-900">{email}</span>
          we've sent a link to reset its password. It works once and expires in 1 hour.
        </p>
        <p className="text-neutral-500">
          Not there after a few minutes? Check spam, or{' '}
          <button
            type="button"
            onClick={resend}
            disabled={cooldown > 0 || resending}
            className="rounded font-medium text-primary-600 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:text-neutral-400 disabled:no-underline"
          >
            {resending ? 'sending…' : cooldown > 0 ? `send it again in ${cooldown}s` : 'send it again'}
          </button>
          .
        </p>
        {resendNote && <p className="text-neutral-700">{resendNote}</p>}
      </div>
      {resendError && (
        <div className="mt-4">
          <FormError message={resendError} />
        </div>
      )}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="secondary" className="flex-1" onClick={onUseDifferentEmail}>
          Use a different email
        </Button>
        <Link to="/login" className={buttonClassName('secondary', 'flex-1')}>
          Log in
        </Link>
      </div>
    </AuthCard>
  )
}
