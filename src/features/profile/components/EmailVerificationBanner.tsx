import { MailWarning, X } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { useEmailVerification } from '@/features/profile/hooks/useEmailVerification'
import { formatRetryDelay, useResendVerification } from '@/features/profile/hooks/useResendVerification'

const feedbackClasses = {
  success: 'text-accent-800',
  info: 'text-warning-900',
  error: 'text-danger-700',
}

/**
 * The app-shell prompt for a user whose address has never been confirmed.
 *
 * It lives in the chrome, not on the profile page, because the consequence is not a
 * profile-page consequence. Until the address is confirmed the account receives **no order
 * receipts, no fulfilment updates and no payment confirmations** — silently, with nothing
 * anywhere else in the product to hint at it. Somebody who is told only "please verify your
 * email" has no reason to bother, so the copy leads with what they are missing.
 *
 * Renders nothing at all for a verified user, a signed-out visitor, an account with no address
 * to confirm, or anyone who dismissed it in the last day.
 */
export function EmailVerificationBanner() {
  const { showPrompt, address, dismiss } = useEmailVerification()
  const { resend, sending, feedback, throttled, secondsRemaining, durationUnknown } = useResendVerification()

  if (!showPrompt) return null

  const retryLabel = durationUnknown ? 'shortly' : formatRetryDelay(secondsRemaining)

  return (
    // `region` + a label rather than `alert`: this is a standing condition the user should be
    // able to find and skip past, not an interruption to announce over whatever they are doing.
    <section
      aria-labelledby="email-verification-banner-title"
      className="flex shrink-0 flex-col gap-3 border-b border-warning-200 bg-warning-50 px-4 py-3 sm:flex-row sm:items-center sm:px-6"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning-100 text-warning-700">
        <MailWarning className="h-4.5 w-4.5" aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <p id="email-verification-banner-title" className="text-sm font-semibold text-warning-900">
          Confirm your email address to start receiving order emails
        </p>
        <p className="mt-0.5 text-sm text-warning-800">
          Until <strong className="break-all">{address}</strong> is confirmed we cannot email you — no order
          receipts, no delivery updates and no payment confirmations. Everything in the app keeps working; it is
          only the emails that stop. Click the link we sent you, or send it again.
        </p>

        {/* The result of the resend is announced where the button is, so a screen reader user
            who just pressed it hears the outcome without hunting for it. */}
        <p aria-live="polite" className="mt-1 min-h-0 text-sm">
          {feedback && <span className={feedbackClasses[feedback.tone]}>{feedback.message}</span>}
          {throttled && (
            <span className="text-warning-800">
              {feedback ? ' ' : ''}
              You can ask for another one {retryLabel}.
            </span>
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => void resend()}
          disabled={sending || throttled}
          aria-busy={sending || undefined}
          className="inline-flex items-center gap-2 rounded-md border border-warning-300 bg-white px-3 py-2 text-sm font-medium text-warning-900 hover:bg-warning-100 focus-visible:ring-2 focus-visible:ring-warning-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending && <Spinner size={16} />}
          {sending ? 'Sending…' : throttled ? `Try again ${retryLabel}` : 'Resend the link'}
        </button>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss — this reminder comes back tomorrow if the address is still unconfirmed"
          className="rounded-md p-2 text-warning-700 hover:bg-warning-100 focus-visible:ring-2 focus-visible:ring-warning-500 focus-visible:outline-none"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
