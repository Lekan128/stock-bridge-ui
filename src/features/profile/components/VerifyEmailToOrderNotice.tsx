import { useContext } from 'react'
import { MailWarning } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Spinner } from '@/components/Spinner'
import { EmailVerificationContext } from '@/features/profile/context/EmailVerificationContext'
import { formatRetryDelay, useResendVerification } from '@/features/profile/hooks/useResendVerification'

const feedbackClasses = {
  success: 'text-accent-800',
  info: 'text-warning-900',
  error: 'text-danger-700',
}

/**
 * Shown where an unverified user would place or pay for an order: the server refuses both until
 * the address is confirmed (`VerifiedEmailGuard`), so the page says so up front and offers the
 * one action that fixes it — rather than letting someone fill three checkout steps first.
 *
 * Unlike the shell banner this cannot be dismissed: it explains why the button next to it is
 * disabled, and hiding that explanation would leave a dead button.
 */
export function VerifyEmailToOrderNotice({ className = '' }: { className?: string }) {
  // Read leniently: pages that render this are also rendered in tests without the shell's
  // provider, and a missing address only costs the resend button, not the explanation.
  const verification = useContext(EmailVerificationContext)
  const address = verification?.address ?? null
  // Only claim "no address" once GET /api/me has actually answered; before that, null means unknown.
  const hasNoAddress = !!verification?.hasLoaded && address === null
  const { resend, sending, feedback, throttled, secondsRemaining, durationUnknown } = useResendVerification()
  const retryLabel = durationUnknown ? 'shortly' : formatRetryDelay(secondsRemaining)

  return (
    <section
      aria-labelledby="verify-to-order-title"
      className={`flex flex-col gap-3 rounded-lg border border-warning-200 bg-warning-50 p-4 sm:flex-row sm:items-center ${className}`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-100 text-warning-700">
        <MailWarning className="h-5 w-5" aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <p id="verify-to-order-title" className="text-sm font-semibold text-warning-900">
          Confirm your email address to place orders
        </p>
        <p className="mt-0.5 text-sm text-warning-800">
          {address ? (
            <>
              Click the link we sent to <strong className="break-all">{address}</strong>, then come back here.
            </>
          ) : !hasNoAddress ? (
            'Click the link we emailed you, then come back here.'
          ) : (
            <>
              Your account has no email address yet.{' '}
              <Link to="/app/profile" className="font-medium underline">
                Add one in your profile
              </Link>{' '}
              and confirm it.
            </>
          )}
        </p>
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

      {!hasNoAddress && (
        <button
          type="button"
          onClick={() => void resend()}
          disabled={sending || throttled}
          aria-busy={sending || undefined}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-warning-300 bg-white px-3 py-2 text-sm font-medium text-warning-900 hover:bg-warning-100 focus-visible:ring-2 focus-visible:ring-warning-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending && <Spinner size={16} />}
          {sending ? 'Sending…' : throttled ? `Try again ${retryLabel}` : 'Resend the link'}
        </button>
      )}
    </section>
  )
}
