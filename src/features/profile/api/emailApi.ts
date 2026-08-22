import { api } from '@/api/client'
import type {
  EmailPreferencesPayload,
  ResendVerificationResponse,
  VerifyEmailResponse,
} from '@/features/profile/types'

/**
 * Everything to do with the signed-in user's email address: confirming it, asking for the
 * confirmation link again, and choosing whether to receive marketing.
 *
 * Split out of `profileApi` rather than folded into it because one of the three is public —
 * `verify` is called from an inbox link by someone who may have no session at all, possibly on a
 * different device from the one they signed up on.
 */
export const emailApi = {
  /**
   * Resend the confirmation link to whatever address is already on the caller's profile.
   *
   * No request body on purpose: accepting an address here would turn this into "email an
   * arbitrary address on ProcurePal's behalf". Rate limited — a 429 carries a `Retry-After`.
   */
  resendVerification: () =>
    api.post<ResendVerificationResponse>('/api/me/email-verification').then((r) => r.data),

  /**
   * Redeem a token from a confirmation email.
   *
   * `public: true` matters twice: it stops the interceptor attaching a bearer token to a call
   * that must work signed-out, and it keeps a failure out of the 401-refresh-retry cycle. (The
   * endpoint answers a bad token with 400 precisely so a signed-in user clicking a stale link is
   * never logged out by it.)
   */
  verify: (token: string) =>
    api.post<VerifyEmailResponse>('/api/email/verify', { token }, { public: true }).then((r) => r.data),

  /** The field is required by the server; `toggle()` always sends it explicitly. */
  updatePreferences: (payload: EmailPreferencesPayload) =>
    api.put<EmailPreferencesPayload>('/api/me/email-preferences', payload).then((r) => r.data),
}
