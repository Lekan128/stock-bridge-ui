/**
 * `clients.payment_terms`. Declared here rather than imported from the super-admin feature so
 * the two surfaces stay decoupled — the same call the codebase already makes for `PageResponse`,
 * which exists independently in features/products and features/users.
 */
export type PaymentTerms = 'PREPAID' | 'PAY_ON_DELIVERY_ALLOWED'

/**
 * The caller's own company — GET and PUT /api/company both return this shape.
 *
 * Four of these fields are reported but never accepted: `clientIdentifier`, `paymentTerms`,
 * `platformOwner` and `active` have no counterpart on UpdateCompanyPayload, by backend design.
 * The UI must render them as facts, not as inputs.
 *
 * `clientIdentifier` is the login slug. The super-admin API calls the same column `slug`
 * (see features/admin/types.ts) — that divergence is intentional and each surface keeps its
 * own vocabulary, so never map one name onto the other.
 *
 * Null fields are omitted from the response JSON entirely
 * (spring.jackson.default-property-inclusion: non_null), hence `phone?: string | null`.
 */
export interface Company {
  id: string
  name: string
  clientIdentifier: string
  adminEmail: string
  phone?: string | null
  active: boolean
  platformOwner: boolean
  paymentTerms: PaymentTerms
  createdAt: string
  updatedAt: string
}

/**
 * PUT /api/company has REPLACE semantics, like PUT /api/me and unlike PUT /api/users/{id}:
 * the settings form always renders every field, so a cleared phone is sent as null and stored
 * as NULL. `name` and `adminEmail` back NOT NULL columns and are always required.
 */
export interface UpdateCompanyPayload {
  name: string
  adminEmail: string
  phone: string | null
}
