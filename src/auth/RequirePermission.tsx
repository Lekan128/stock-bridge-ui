import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { Permission } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'

export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { user } = useAuth()
  const permissions = user?.type === 'tenant' ? user.permissions : []

  if (!permissions.includes(permission)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
