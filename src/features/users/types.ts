/**
 * A role id, as sent back to PUT/POST /api/users and as the value RoleSelectField compares
 * against. Roles are defined by the backend (GET /api/roles), and since a tenant can now define
 * its own custom roles (which are unique per tenant, not globally), assignment is by id rather
 * than by name — the UI never hardcodes a list, fetch with useRoles() and render whatever comes
 * back. Display labels for SYSTEM roles come from formatRoleName() in ./formatters; a custom
 * role's name is shown as the tenant typed it — see Role.isSystem.
 */
export type UserRole = string

/** One entry of GET /api/roles. */
export interface Role {
  id: string
  name: string
  description: string
  permissions: string[]
  /** OWNER, PROCUREMENT_MANAGER, INVENTORY_OFFICER, FINANCE_OFFICER, STOREKEEPER — fixed, not editable. */
  isSystem: boolean
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
  roleId: UserRole
  roleName: string
  roleIsSystem: boolean
  root: boolean
  active: boolean
  createdAt: string
}

export interface CreateUserPayload {
  username: string
  password: string
  roleId: UserRole
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  jobTitle?: string | null
}

/** PUT /api/users/{id} has PATCH semantics — omitted keys are left unchanged. */
export interface UpdateUserPayload {
  roleId?: UserRole
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
