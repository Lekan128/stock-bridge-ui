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
