import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { Permission } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'

/**
 * Either one required code, or a set of which any one is enough — never both.
 *
 * `anyOf` exists because several APIs authorize a disjunction and this guard could only express
 * a single code, which forced a choice between locking out half a screen's audience or dropping
 * the guard entirely (see the notes on `selling/analytics` and `selling/statement` in
 * `routes/router.tsx`, both of which took the second option). Bulk import made that no longer
 * tolerable: its controller authorizes `MANAGE_PRODUCTS or MANAGE_INVENTORY` (bulk-import
 * contract §3), and a storekeeper who holds only `MANAGE_INVENTORY` is precisely the user bulk
 * stock-in exists for. The union type keeps every existing single-permission call site
 * compiling untouched while making "one of these" sayable.
 */
export type RequirePermissionProps = { children: ReactNode } & (
  | { permission: Permission; anyOf?: never }
  | { anyOf: readonly Permission[]; permission?: never }
)

export function RequirePermission({ permission, anyOf, children }: RequirePermissionProps) {
  const { user } = useAuth()
  const permissions = user?.type === 'tenant' ? user.permissions : []

  const required: readonly Permission[] = anyOf ?? (permission ? [permission] : [])
  const allowed = required.some((code) => permissions.includes(code))

  if (!allowed) {
    // Back to the workspace dashboard, not `/` — `/` is now the public storefront.
    return <Navigate to="/app" replace />
  }

  return <>{children}</>
}
