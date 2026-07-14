import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useSuperAdminAuth } from '@/auth/useSuperAdminAuth'
import { BootstrappingScreen } from '@/components/BootstrappingScreen'

export function RedirectIfSuperAdminAuthenticated({ children }: { children: ReactNode }) {
  const { isAuthenticated, isBootstrapping } = useSuperAdminAuth()

  if (isBootstrapping) {
    return <BootstrappingScreen />
  }

  if (isAuthenticated) {
    return <Navigate to="/admin/tenants" replace />
  }

  return children
}
