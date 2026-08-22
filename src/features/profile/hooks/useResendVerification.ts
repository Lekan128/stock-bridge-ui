import { useCallback, useEffect, useState } from 'react'
import { emailApi } from '@/features/profile/api/emailApi'
import { isAppError } from '@/types/api'

/**
 * How long to lock the button when the server says "too many" but the browser could not read the
 * `Retry-After` header.
 *
 * That happens on every cross-origin deployment — `Retry-After` is not CORS-safelisted, so it is
 * invisible to JavaScript unless the API adds it to `Access-Control-Expose-Headers`, which it
 * does not today. A minute is chosen to be obviously short: the alternative, assuming the
 * documented one-hour window, would disable the button for an hour on a guess, and being wrong
 * in that direction strands a user who genuinely needs the mail. Retrying too early just earns
 * the same honest refusal again.
 */
const UNKNOWN_THROTTLE_FALLBACK_SECONDS = 60

/**
 * A short local pause after a link actually goes out.
 *
 * Not a rate limit — the server has one of those. This exists because the mail takes a few
 * seconds to arrive, and someone who clicks four times while waiting spends their whole hourly
 * budget and invalidates three of their own links (each resend supersedes the last).
 */
const SENT_COOLDOWN_SECONDS = 60

export type ResendTone = 'success' | 'info' | 'error'

export interface ResendFeedback {
  tone: ResendTone
  message: string
}

export interface ResendVerificationState {
  resend: () => Promise<void>
  sending: boolean
  /** The server's own words, or ours only when the request never reached it. */
  feedback: ResendFeedback | null
  /** True while the button must stay disabled. */
  throttled: boolean
  /** Seconds left on the cooldown; 0 when not throttled. Ticks down once a second. */
  secondsRemaining: number
  /** True when the throttle came from a 429 whose duration the browser could not read. */
  durationUnknown: boolean
}

/**
 * "Send me the confirmation link again", with its pending, success, information and
 * rate-limited states.
 *
 * Shared by the shell banner and the profile page's email panel, which is the point: a user who
 * dismisses the banner still needs somewhere to do this, and the two must not disagree about what
 * happened.
 */
export function useResendVerification(): ResendVerificationState {
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState<ResendFeedback | null>(null)
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)
  const [durationUnknown, setDurationUnknown] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const secondsRemaining = cooldownUntil ? Math.max(0, Math.ceil((cooldownUntil - now) / 1000)) : 0

  // Only ticks while a cooldown is actually running, and clears itself the moment it elapses so
  // the button re-enables without anyone having to navigate or reload.
  useEffect(() => {
    if (!cooldownUntil) return
    setNow(Date.now())
    const id = setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= cooldownUntil) setCooldownUntil(null)
    }, 1000)
    return () => clearInterval(id)
  }, [cooldownUntil])

  const resend = useCallback(async () => {
    if (cooldownUntil && cooldownUntil > Date.now()) return
    setSending(true)
    setFeedback(null)
    setDurationUnknown(false)

    try {
      const response = await emailApi.resendVerification()
      // `sent: false` is a success: "already confirmed", or "no address on your profile". Both
      // arrive with better copy than we could write, so it is rendered verbatim and never in an
      // error style. Only an actual send earns a cooldown — there is nothing to wait for
      // otherwise.
      setFeedback({ tone: response.sent ? 'success' : 'info', message: response.message })
      if (response.sent) {
        setNow(Date.now())
        setCooldownUntil(Date.now() + SENT_COOLDOWN_SECONDS * 1000)
      }
    } catch (err) {
      if (isAppError(err) && err.status === 429) {
        const seconds = err.retryAfterSeconds ?? UNKNOWN_THROTTLE_FALLBACK_SECONDS
        setDurationUnknown(err.retryAfterSeconds === undefined)
        setNow(Date.now())
        setCooldownUntil(Date.now() + seconds * 1000)
        // Being rate limited is not a fault the user can fix, and painting it red suggests
        // something broke. The server's message already explains it.
        setFeedback({ tone: 'info', message: err.message })
        return
      }
      setFeedback({
        tone: 'error',
        message: isAppError(err) ? err.message : 'We could not send the confirmation link. Please try again.',
      })
    } finally {
      setSending(false)
    }
  }, [cooldownUntil])

  return { resend, sending, feedback, throttled: secondsRemaining > 0, secondsRemaining, durationUnknown }
}

/** "in 45 seconds" / "in about 12 minutes" / "in about an hour" — never a bare second count. */
export function formatRetryDelay(seconds: number): string {
  if (seconds <= 1) return 'in a moment'
  if (seconds < 60) return `in ${seconds} seconds`

  const minutes = Math.round(seconds / 60)
  if (minutes === 1) return 'in about a minute'
  if (minutes < 60) return `in about ${minutes} minutes`

  const hours = Math.round(minutes / 60)
  return hours === 1 ? 'in about an hour' : `in about ${hours} hours`
}
