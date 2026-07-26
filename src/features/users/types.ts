/**
 * Role codes are defined by the backend (GET /api/roles) and user-defined roles are planned,
 * so the UI never hardcodes a list — fetch with useRoles() and render whatever comes back.
 * Display labels come from formatRoleName() in ./formatters.
 */
export type UserRole = string

/** One entry of GET /api/roles. */
export interface Role {
  name: UserRole
  description: string
  permissions: string[]
}

/** Mirrors Spring Data's Page<T> JSON shape. */
export interface PageResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first: boolean
  last: boolean
}

// Null profile fields are omitted from the response JSON entirely
// (spring.jackson.default-property-inclusion: non_null), hence `| undefined`.
export interface TenantUserSummary {
  id: string
  username: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  jobTitle?: string | null
  role: UserRole
  root: boolean
  active: boolean
  createdAt: string
}

export interface CreateUserPayload {
  username: string
  password: string
  role: UserRole
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  jobTitle?: string | null
}

/** PUT /api/users/{id} has PATCH semantics — omitted keys are left unchanged. */
export interface UpdateUserPayload {
  role?: UserRole
  active?: boolean
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  jobTitle?: string
}

export interface ResetPasswordPayload {
  newPassword: string
  confirmNewPassword: string
}
