import { useEffect, useState } from 'react'
import { permissionsApi } from '@/features/roles/api/rolesManagementApi'
import type { PermissionCatalogEntry } from '@/features/roles/types'
import { isAppError } from '@/types/api'

/** The full privilege catalogue for the Roles & Privileges matrix — nothing here is hardcoded. */
export function usePermissionCatalog() {
  const [data, setData] = useState<PermissionCatalogEntry[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    permissionsApi
      .list()
      .then((response) => {
        if (!cancelled) setData(response)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(isAppError(err) ? err.message : 'Could not load permissions. Please try again.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { data, loading, error }
}
