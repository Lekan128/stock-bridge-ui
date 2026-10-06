import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '@/api/authApi'
import { resetPasswordSchema, type ResetPasswordFormValues } from '@/auth/schemas'
import { useAuth } from '@/auth/useAuth'
import { AuthCard } from '@/components/AuthCard'
import { Button, buttonClassName } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { PasswordField } from '@/components/PasswordField'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/useToast'
import { isAppError } from '@/types/api'
import type { PasswordResetAccount } from '@/types/auth'
import { authStorage } from '@/utils/storage'

type Phase =
  | { kind: 'missing-token' }
  | { kind: 'checking' }
  | { kind: 'ready'; account: PasswordResetAccount }
  | { kind: 'rejected' }
  | { kind: 'unreachable' }

/**
 * `/reset-password?token=…` — the page the reset email links to (PASSWORD_RESET_PLAN.md, screen 3).
 *
 * The same phase model as `VerifyEmailPage`, with one difference that matters: opening this page
 * only CHECKS the link. Mail scanners, a refresh or opening it twice never use it up; only
 * "Set new password" does. So unlike verification there is no spent-token guard to need — a
 * second check under StrictMode is harmless.
 *
 * Deliberately not behind `RedirectIfAuthenticated`: someone signed in on this device must still
 * be able to use a link they asked for.
 */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [phase, setPhase] = useState<Phase>(token ? { kind: 'checking' } : { kind: 'missing-token' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setPhase({ kind: 'checking' })
    authApi
      .checkPasswordReset(token)
      .then((account) => {
        if (!cancelled) setPhase({ kind: 'ready', account })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        // 400 is every dead link (expired, used, superseded, account changed) with one message on
        // purpose; anything else is network or server trouble, and the link is still good.
        setPhase(isAppError(err) && err.status === 400 ? { kind: 'rejected' } : { kind: 'unreachable' })
      })
    return () => {
      cancelled = true
    }
  }, [token, attempt])

  if (phase.kind === 'ready') {
    // `ready` is only ever reached with a token in the URL.
    return <ResetForm token={token ?? ''} account={phase.account} onLinkDied={() => setPhase({ kind: 'rejected' })} />
  }

  return <LinkState phase={phase} onRetry={() => setAttempt((n) => n + 1)} />
}

const STATE_COPY = {
  'missing-token': {
    title: 'This link is incomplete',
    body: "It has no code in it, which usually means your email app cut the address short. Open the link from the email again, or ask for a new one.",
  },
  checking: { title: 'Checking your link…', body: '' },
  rejected: {
    title: "This reset link doesn't work any more",
    body: 'Reset links work once and expire after an hour. Asking for a new one always works.',
  },
  unreachable: {
    title: "We couldn't check your link",
    body: "Check your connection and try again. Your link hasn't been used.",
  },
} as const

function LinkState({ phase, onRetry }: { phase: Exclude<Phase, { kind: 'ready' }>; onRetry: () => void }) {
  const copy = STATE_COPY[phase.kind]
  const checking = phase.kind === 'checking'

  return (
    <AuthCard showcase title={copy.title}>
      {/* Each outcome replaces "Checking…" with no navigation, so it is announced. */}
      <div aria-live="polite" aria-busy={checking} className="text-center text-sm text-neutral-600">
        {checking ? (
          <div className="flex justify-center py-2">
            <Spinner size={22} />
          </div>
        ) : (
          <p>{copy.body}</p>
        )}
      </div>
      {!checking && (
        <div className="mt-6 flex flex-col gap-2">
          {phase.kind === 'unreachable' ? (
            <Button type="button" className="w-full" onClick={onRetry}>
              Try again
            </Button>
          ) : (
            <Link to="/forgot-password" className={buttonClassName('primary', 'w-full')}>
              Send a new link
            </Link>
          )}
          <Link to="/login" className={buttonClassName('secondary', 'w-full')}>
            Log in
          </Link>
        </div>
      )}
    </AuthCard>
  )
}

function ResetForm({
  token,
  account,
  onLinkDied,
}: {
  token: string
  account: PasswordResetAccount
  onLinkDied: () => void
}) {
  const { adoptTenantSession } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '' },
  })

  async function onSubmit(values: ResetPasswordFormValues) {
    setFormError(null)
    try {
      const session = await authApi.completePasswordReset(token, values.newPassword)
      // They just proved they read the inbox; asking them to log in again (with a Company ID they
      // may not remember) is the friction this flow exists to remove. Owners' decision, 2026-10-06.
      authStorage.setLastClientIdentifier(session.user.clientIdentifier)
      adoptTenantSession(session)
      showToast('Password changed. Any other devices have been logged out.', 'success')
      navigate('/app', { replace: true })
    } catch (err) {
      if (isAppError(err) && err.status === 400 && /reset link/i.test(err.message)) {
        // The link expired or was used while the form was open.
        onLinkDied()
      } else if (isAppError(err) && err.status === 400) {
        setFormError(err.message)
      } else {
        setFormError("We couldn't save your new password. Check your connection and try again. Your link still works.")
      }
    }
  }

  return (
    <AuthCard showcase title="Set a new password" subtitle={`For ${account.login} at ${account.companyName}.`}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {/* Lets password managers save the new password against the right login. */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          value={account.login}
          readOnly
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
        />
        <PasswordField
          label="New password"
          autoComplete="new-password"
          hint="At least 8 characters."
          autoFocus
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <FormError message={formError} />
        <Button type="submit" loading={isSubmitting} className="w-full">
          Set new password
        </Button>
      </form>
    </AuthCard>
  )
}
