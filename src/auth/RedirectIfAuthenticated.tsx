import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { BootstrappingScreen } from '@/components/BootstrappingScreen'

export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { isAuthenticated, isBootstrapping } = useAuth()

  if (isBootstrapping) {
    return <BootstrappingScreen />
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return children
}
