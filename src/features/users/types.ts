export const USER_ROLES = ['ADMIN', 'MANAGER', 'STAFF'] as const

export type UserRole = (typeof USER_ROLES)[number]

export interface RoleOption {
  value: UserRole
  label: string
  description: string
}

export const ROLE_OPTIONS: RoleOption[] = [
  { value: 'ADMIN', label: 'Admin', description: 'Full access including user management' },
  { value: 'MANAGER', label: 'Manager', description: 'Manage products, inventory, and view analytics' },
  { value: 'STAFF', label: 'Staff', description: 'Manage inventory only' },
]

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

export interface TenantUserSummary {
  id: string
  username: string
  role: UserRole
  active: boolean
  createdAt: string
}

export interface CreateUserPayload {
  username: string
  password: string
  role: UserRole
}

export interface UpdateUserPayload {
  role?: UserRole
  active?: boolean
}

export interface ResetPasswordPayload {
  newPassword: string
  confirmNewPassword: string
}
