import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { BootstrappingScreen } from '@/components/BootstrappingScreen'
import { DEFAULT_AUTHENTICATED_PATH, readRedirectParam } from '@/utils/redirectTarget'

export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { isAuthenticated, isBootstrapping } = useAuth()
  const location = useLocation()

  if (isBootstrapping) {
    return <BootstrappingScreen />
  }

  if (isAuthenticated) {
    // Honour ?redirect= here too, not only after a form submit: an already-logged-in visitor who
    // follows a `/login?redirect=/checkout` link should land on checkout, not the dashboard.
    return <Navigate to={readRedirectParam(location.search) ?? DEFAULT_AUTHENTICATED_PATH} replace />
  }

  return children
}
