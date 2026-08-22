/**
 * GET /api/me. Null fields are omitted from the response entirely
 * (spring.jackson.default-property-inclusion: non_null), hence `| undefined` throughout.
 */
export interface Profile {
  id: string
  username: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  /**
   * Whether the address on this account has been confirmed by clicking a link sent to it.
   *
   * Read-only: the only writer in the whole system is redeeming a token at POST /api/email/verify,
   * and it is deliberately absent from UpdateProfilePayload. It matters far beyond a checkmark —
   * an unverified user receives no order receipts, no fulfilment updates and no payment
   * confirmations at all, silently. That is what EmailVerificationBanner exists to say out loud.
   *
   * Note the address this describes is the *effective* one: `email` when set, otherwise
   * `username` (the account holder of a new company often signs up with their address as their
   * username and no separate email). Use `verifiableEmailAddress()` rather than reading `email`.
   */
  emailVerified: boolean
  /** Read-only here; written through PUT /api/me/email-preferences, never PUT /api/me. */
  receivePromotionalEmail: boolean
  phone?: string | null
  jobTitle?: string | null
  role: string
  permissions: string[]
  root: boolean
  active: boolean
  createdAt: string
  clientName?: string | null
  clientIdentifier?: string | null
}

/**
 * PUT /api/me has REPLACE semantics: every field must be sent on every call, because an
 * omitted or null field is cleared. Never reuse this payload against PUT /api/users/{id}.
 */
export interface UpdateProfilePayload {
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  jobTitle: string | null
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
  confirmNewPassword: string
}

/**
 * The address a verification link would actually be sent to.
 *
 * Mirrors the backend's `effectiveAddress`: `email` when present, otherwise `username`, because
 * the first user of a company usually signs up with their address as their username and no
 * separate email field. The `@` test is the frontend's own guard — a sub-user called
 * "warehouse-lead" has no address to confirm at all, and naming them one in the UI would be a
 * lie. Returns null when this account has nothing verifiable.
 */
export function verifiableEmailAddress(profile: Pick<Profile, 'email' | 'username'>): string | null {
  const candidate = profile.email?.trim() || profile.username?.trim() || ''
  return candidate.includes('@') ? candidate : null
}

/**
 * POST /api/me/email-verification.
 *
 * `sent: false` is a SUCCESS, not a failure — it is how the API says "already confirmed" or
 * "there is no address on your profile". Both carry copy in `message` that is better than
 * anything the frontend could invent, so render it verbatim and never as an error.
 */
export interface ResendVerificationResponse {
  sent: boolean
  message: string
}

/**
 * POST /api/email/verify — public, no auth header.
 *
 * The 400 that replaces this on failure is byte-identical for unknown, expired, already-used,
 * superseded and address-changed tokens. That is deliberate (the status code and body are as much
 * of an oracle as anything else), so the UI must not try to guess which one happened.
 */
export interface VerifyEmailResponse {
  verified: boolean
  message: string
}

/** PUT /api/me/email-preferences. The field is required — omitting it is a 400, not an opt-out. */
export interface EmailPreferencesPayload {
  receivePromotionalEmail: boolean
}
