import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { BootstrappingScreen } from '@/components/BootstrappingScreen'
import { buildLoginPath } from '@/utils/redirectTarget'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isBootstrapping } = useAuth()
  const location = useLocation()

  if (isBootstrapping) {
    return <BootstrappingScreen />
  }

  if (!isAuthenticated) {
    // The return target goes in the query string, not just router state: checkout can be
    // reached by pasting a link or after a hard reload, both of which lose in-memory state,
    // and `/login?redirect=/checkout` survives that. State is still passed for older links.
    const target = `${location.pathname}${location.search}`
    return <Navigate to={buildLoginPath(target)} replace state={{ from: location }} />
  }

  return children
}
