import { useEffect, useState } from 'react'
import { usersApi, type UserListParams } from '@/features/users/api/usersApi'
import type { PageResponse, TenantUserSummary } from '@/features/users/types'
import { isAppError } from '@/types/api'

export function useUsers(params: UserListParams) {
  const [data, setData] = useState<PageResponse<TenantUserSummary> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const paramsKey = JSON.stringify(params)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    usersApi
      .list(params)
      .then((response) => {
        if (!cancelled) setData(response)
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
    // paramsKey is a stable stand-in for params (a fresh object each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, reloadToken])

  return { data, loading, error, refetch: () => setReloadToken((t) => t + 1) }
}
