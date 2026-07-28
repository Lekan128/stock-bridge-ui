import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'

/**
 * Gates the ProcurePal-only marketplace-admin screens.
 *
 * This is deliberately a *second*, independent guard rather than another permission check:
 * MANAGE_MARKETPLACE and friends are granted to every tenant's OWNER role, so permission alone
 * would let any company's owner open ProcurePal's fulfilment queue. It mirrors the backend's
 * platform-owner guard on `/api/marketplace/admin/**` (contract §6) — and, like every guard in
 * this app, it is UI hygiene only. The server is what actually enforces this.
 *
 * Wrap it OUTSIDE RequirePermission so a non-platform-owner is bounced without the route ever
 * hinting at which permission it wanted.
 */
export function RequirePlatformOwner({ children }: { children: ReactNode }) {
  const { isPlatformOwner } = useAuth()

  if (!isPlatformOwner) {
    return <Navigate to="/app" replace />
  }

  return <>{children}</>
}
