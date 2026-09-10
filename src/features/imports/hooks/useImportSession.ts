import { useCallback, useEffect, useRef, useState } from 'react'
import { importsApi } from '@/features/imports/api/importsApi'
import type { ImportSession } from '@/features/imports/types'
import { isAppError } from '@/types/api'

/**
 * Loads one upload and keeps it in state.
 *
 * `apply` exists because several endpoints (`resolveValue`, `patchMapping`) return the whole
 * refreshed record — taking it directly is both cheaper and less flickery than refetching, and
 * it is what keeps the counters honest the instant a bulk fix lands.
 *
 * Hand-rolled rather than react-query, matching `features/products/hooks/useProducts.ts`.
 */
export function useImportSession(id: string | undefined) {
  const [session, setSession] = useState<ImportSession | null>(null)
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
      .get(id)
      .then((response) => {
        if (!cancelled) setSession(response)
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
  }, [id, reloadToken])

  const apply = useCallback((next: ImportSession) => setSession(next), [])
  const refetch = useCallback(() => setReloadToken((token) => token + 1), [])

  // Fixing rows back-to-back (easy to do from the "All" view, where issues aren't grouped
  // together) fires overlapping `refresh()` calls. Without a sequence guard, a slow response to
  // an *earlier* fix can land after a faster response to a *later* one and overwrite it — pinning
  // the counters, and the Continue gate, on a stale count forever with nothing left to re-trigger
  // a refresh. Only the response to the most recently issued refresh is allowed to apply.
  const refreshSeq = useRef(0)

  /**
   * Re-read the counters without blanking the screen.
   *
   * Fixing a cell changes how many rows still need attention, and that number is announced by
   * `aria-live` — so it has to be true after an inline edit, not only after a bulk fix. A full
   * `refetch` would flip the page back to its skeleton mid-repair, which is worse than the stale
   * number it fixes, hence a separate quiet path.
   */
  const refresh = useCallback(() => {
    if (!id) return
    const seq = ++refreshSeq.current
    importsApi
      .get(id)
      .then((response) => {
        if (seq === refreshSeq.current) setSession(response)
      })
      .catch(() => {
        /* the screen already has a usable record; a failed counter refresh is not worth a toast */
      })
  }, [id])

  return { session, loading, error, apply, refetch, refresh }
}
