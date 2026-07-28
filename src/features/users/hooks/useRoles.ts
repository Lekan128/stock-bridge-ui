import { useEffect, useState } from 'react'
import { rolesApi } from '@/features/users/api/rolesApi'
import type { Role } from '@/features/users/types'
import { isAppError } from '@/types/api'

/** Roles are the backend's to define (GET /api/roles) — nothing here is hardcoded. */
export function useRoles() {
  const [data, setData] = useState<Role[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    rolesApi
      .list()
      .then((response) => {
        if (!cancelled) setData(response)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(isAppError(err) ? err.message : 'Could not load roles. Please try again.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  return { data, loading, error, refetch: () => setReloadToken((t) => t + 1) }
}
