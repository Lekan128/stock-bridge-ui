import { useState } from 'react'
import { CircleCheck, MailWarning } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { FormError } from '@/components/FormError'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/useToast'
import { emailApi } from '@/features/profile/api/emailApi'
import { formatRetryDelay, useResendVerification } from '@/features/profile/hooks/useResendVerification'
import { verifiableEmailAddress, type Profile } from '@/features/profile/types'
import { isAppError } from '@/types/api'

export interface EmailSettingsPanelProps {
  profile: Profile
  onUpdated: (profile: Profile) => void
}

const feedbackClasses = {
  success: 'text-accent-700',
  info: 'text-neutral-600',
  error: 'text-danger-600',
}

/**
 * The profile page's email section: whether the address is confirmed, a way to fix it if not, and
 * the one email preference the user actually controls.
 *
 * The verification half is duplicated from the shell banner on purpose. The banner is
 * dismissible, and someone who dismissed it still needs a place to act — while a user who came
 * here to change their address needs to see, in the same view, that changing it un-confirms it.
 * Both share `useResendVerification`, so they cannot disagree about what happened.
 *
 * `emailVerified` and `receivePromotionalEmail` are both read-only on PUT /api/me: the first has
 * exactly one writer anywhere (redeeming a token), and the second is written by its own endpoint.
 * Neither is a field on the details form above.
 */
export function EmailSettingsPanel({ profile, onUpdated }: EmailSettingsPanelProps) {
  const { showToast } = useToast()
  const { resend, sending, feedback, throttled, secondsRemaining, durationUnknown } = useResendVerification()
  const [savingPreference, setSavingPreference] = useState(false)
  const [preferenceError, setPreferenceError] = useState<string | null>(null)

  const address = verifiableEmailAddress(profile)
  const retryLabel = durationUnknown ? 'shortly' : formatRetryDelay(secondsRemaining)

  async function togglePromotional() {
    const next = !profile.receivePromotionalEmail
    setSavingPreference(true)
    setPreferenceError(null)
    try {
      // The field is always sent explicitly — the server rejects an absent one with a 400 rather
      // than reading it as "off", which is the right call and worth not fighting.
      const updated = await emailApi.updatePreferences({ receivePromotionalEmail: next })
      // Seeded from the server's answer rather than from `next`, so the switch shows what was
      // actually stored.
      onUpdated({ ...profile, receivePromotionalEmail: updated.receivePromotionalEmail })
      showToast(
        updated.receivePromotionalEmail
          ? 'You will receive offers and product news.'
          : 'You will no longer receive offers and product news.',
        'success',
      )
    } catch (err) {
      setPreferenceError(
        isAppError(err) ? err.message : 'That preference could not be saved. Please try again.',
      )
    } finally {
      setSavingPreference(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-neutral-200 bg-white p-5">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">Email</h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          Where your order receipts, delivery updates and payment confirmations go.
        </p>
      </div>

      <div className="flex flex-col gap-2 border-b border-neutral-100 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium break-all text-neutral-900">{address ?? 'No email address'}</span>
          {address === null ? (
            <Badge variant="neutral">Nothing to confirm</Badge>
          ) : profile.emailVerified ? (
            <Badge variant="success">
              <CircleCheck className="h-3 w-3" aria-hidden="true" />
              Confirmed
            </Badge>
          ) : (
            <Badge variant="warning">
              <MailWarning className="h-3 w-3" aria-hidden="true" />
              Not confirmed
            </Badge>
          )}
        </div>

        {address === null && (
          <p className="text-sm text-neutral-600">
            There is no email address on this account, so we have no way to send you order receipts, delivery
            updates or payment confirmations. Add one in <strong>Your details</strong> above and then confirm it.
          </p>
        )}

        {address !== null && profile.emailVerified && (
          <p className="text-sm text-neutral-600">
            This address is confirmed, so order receipts, delivery updates and payment confirmations reach you.
            Changing it below will un-confirm it until you confirm the new one.
          </p>
        )}

        {address !== null && !profile.emailVerified && (
          <>
            <p className="text-sm text-neutral-600">
              We are not sending anything to this address yet — no order receipts, no delivery updates, no payment
              confirmations — because nobody has clicked the confirmation link we sent to it.
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void resend()}
                disabled={sending || throttled}
                aria-busy={sending || undefined}
                className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending && <Spinner size={16} />}
                {sending ? 'Sending…' : throttled ? `Try again ${retryLabel}` : 'Send the link again'}
              </button>
            </div>
            <p aria-live="polite" className="text-sm">
              {feedback && <span className={feedbackClasses[feedback.tone]}>{feedback.message}</span>}
              {throttled && (
                <span className="text-neutral-600">
                  {feedback ? ' ' : ''}
                  You can ask for another one {retryLabel}.
                </span>
              )}
            </p>
          </>
        )}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p id="promotional-email-label" className="text-sm font-medium text-neutral-900">
            Offers and product news
          </p>
          <p className="mt-0.5 text-sm text-neutral-500">
            Occasional emails about new suppliers, price changes and features. Turning this off never affects
            order receipts, delivery updates or payment confirmations — those always come.
          </p>
        </div>

        {/* A real switch, not a checkbox: this saves the instant it is pressed rather than being
            a form value submitted later, and it should be announced as on/off. */}
        <button
          type="button"
          role="switch"
          aria-checked={profile.receivePromotionalEmail}
          aria-labelledby="promotional-email-label"
          aria-busy={savingPreference || undefined}
          disabled={savingPreference}
          onClick={() => void togglePromotional()}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:outline-none ${
            profile.receivePromotionalEmail ? 'bg-accent-600' : 'bg-neutral-300'
          } ${savingPreference ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          <span
            aria-hidden="true"
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              profile.receivePromotionalEmail ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <FormError message={preferenceError} />
    </div>
  )
}
