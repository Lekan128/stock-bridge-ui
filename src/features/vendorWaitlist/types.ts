/**
 * The public vendor waitlist — the anonymous half. The super-admin half (the review queue and
 * vendor accounts) lives in `@/features/admin/types` beside the other operator screens, because
 * it is read with a super-admin token and shares that feature's API client.
 */

/** Mirrors the backend's VendorWaitlistApplicationRequest. */
export interface VendorWaitlistApplicationPayload {
  businessName: string
  email: string
  contactPhone: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  notes?: string
}

/**
 * What the server sends back, which is one sentence and deliberately nothing else.
 *
 * There is no id, no status and no echo of the email in here, and that is a security property
 * rather than an oversight: the endpoint is unauthenticated, so anything the response varied on
 * would be something an anonymous caller could enumerate. A repeat application from an address
 * that has applied before is accepted, stored and acknowledged identically to a first one, so the
 * form cannot be used to ask "does this business deal with ProcurePaddy" one address at a time.
 *
 * The consequence for this screen: it must render its own success copy and must not try to tell
 * the applicant anything about their position, their history, or when to expect an answer.
 */
export interface VendorWaitlistApplicationResponse {
  message: string
}
