import { useEffect, useState } from 'react'
import { superAdminApiClient } from '@/features/admin/api/superAdminApi'
import type { SuperAdminClientDetail } from '@/features/admin/types'
import { isAppError } from '@/types/api'

export function useClientDetail(id: string | undefined) {
  const [client, setClient] = useState<SuperAdminClientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    let cancelled = false
    setLoading(true)
    setError(null)

    superAdminApiClient
      .getClient(id)
      .then((response) => {
        if (!cancelled) setClient(response)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(isAppError(err) ? err.message : 'Something went wrong. Please try again.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  return { client, setClient, loading, error }
}
