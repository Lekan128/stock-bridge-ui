import { useEffect, useRef, type ReactNode } from 'react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { startCatalog, stopCatalog } from '@/features/catalog/catalogStore'

/**
 * Runs the on-device catalogue for whoever is signed in and allowed to see products, and deletes
 * it from the device when they sign out — the same lifetime as the query cache (`QueryProvider`),
 * for the same reason: a company's stock must not outlive the session on a shared device.
 */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const { user, client } = useAuth()
  const canViewProducts = user?.permissions.includes(PERMISSIONS.VIEW_PRODUCTS) === true
  const databaseName =
    user && canViewProducts ? `procurepaddy-catalog:${client?.id ?? 'unknown'}:${user.id}` : null
  const running = useRef<string | null>(null)

  useEffect(() => {
    const previous = running.current
    running.current = databaseName
    if (databaseName != null) {
      void startCatalog(databaseName)
    } else if (previous != null) {
      void stopCatalog({ deleteData: true })
    }
  }, [databaseName])

  // A different user on this device: the previous user's copy goes, not just stops.
  useEffect(() => {
    return () => {
      void stopCatalog({ deleteData: false })
    }
  }, [])

  return children
}
