import { useCallback, useEffect, useState } from 'react'
import { importsApi } from '@/features/imports/api/importsApi'
import { GRID_PAGE_SIZE } from '@/features/imports/constants'
import type { ImportRow } from '@/features/imports/types'
import { isAppError } from '@/types/api'

export type RowFilter = 'ALL' | 'ISSUES'

/**
 * The rows behind the review grid.
 *
 * "Issues" is one request. `status=ISSUES` is a server-side pseudo-filter meaning ERROR+WARNING
 * (contract §3) — it has to include warnings, because an update row whose quantity is being
 * ignored (§8.8) is a warning, and hiding it behind a filter called "Issues" would be the exact
 * silent drop that rule forbids. Merging two client-side requests would have given a page count
 * that is wrong the moment a file has more than one page of issues, so the server owns it.
 */
export function useImportRows(id: string | undefined, filter: RowFilter, page: number) {
  const [rows, setRows] = useState<ImportRow[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [totalElements, setTotalElements] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)

    importsApi
      .rows(id, { status: filter, page, size: GRID_PAGE_SIZE })
      .then((response) => {
        if (cancelled) return
        setRows(response.content)
        setTotalPages(response.totalPages)
        setTotalElements(response.totalElements)
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
  }, [id, filter, page, reloadToken])

  /** Swap one row in place — what a `patchRow` response is for (contract §3). */
  const applyRow = useCallback((next: ImportRow) => {
    setRows((current) => current.map((row) => (row.id === next.id ? next : row)))
  }, [])

  const refetch = useCallback(() => setReloadToken((token) => token + 1), [])

  return { rows, totalPages, totalElements, loading, error, applyRow, refetch }
}
