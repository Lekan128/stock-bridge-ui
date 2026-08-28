import { useCallback, useEffect, useState } from 'react'
import { importsApi } from '@/features/imports/api/importsApi'
import { RECENT_IMPORTS_PAGE_SIZE } from '@/features/imports/constants'
import type { ImportKind, ImportSessionSummary } from '@/features/imports/types'
import { isAppError } from '@/types/api'

export function useRecentImports(kind?: ImportKind, size = RECENT_IMPORTS_PAGE_SIZE) {
  const [items, setItems] = useState<ImportSessionSummary[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    importsApi
      .list({ kind, page: 0, size })
      .then((response) => {
        if (!cancelled) setItems(response.content)
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
  }, [kind, size, reloadToken])

  const refetch = useCallback(() => setReloadToken((token) => token + 1), [])

  return { items, loading, error, refetch }
}
