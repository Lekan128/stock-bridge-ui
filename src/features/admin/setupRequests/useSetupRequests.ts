import { useCallback, useEffect, useRef, useState } from 'react'
import {
  setupRequestsApi,
  type SetupRequest,
  type SetupRequestCounts,
  type SetupRequestTab,
} from '@/features/admin/setupRequests/setupRequestsApi'
import type { PageResponse } from '@/features/products/types'
import { isAppError } from '@/types/api'

/** How often an open queue checks for new requests. A reply is due within 5 minutes. */
const POLL_MS = 30_000

/**
 * The setup queue and its counts, kept fresh while the tab is open: speed to lead (plan rule 5)
 * means somebody may leave this open all day, and a request that appears only on reload is a
 * request answered late. Hand-rolled like the other admin hooks (no react-query on these screens).
 *
 * `onNew` is called with requests that arrived since the last check (never on the first load).
 */
export function useSetupRequests(
  params: { tab?: SetupRequestTab; page: number; size: number },
  onNew?: (requests: SetupRequest[]) => void,
) {
  const [data, setData] = useState<PageResponse<SetupRequest> | null>(null)
  const [counts, setCounts] = useState<SetupRequestCounts | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const seenNew = useRef<Set<string> | null>(null)
  const onNewRef = useRef(onNew)
  useEffect(() => {
    onNewRef.current = onNew
  }, [onNew])
  const paramsKey = JSON.stringify(params)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([setupRequestsApi.list(params), setupRequestsApi.counts()])
      .then(([page, nextCounts]) => {
        if (cancelled) return
        setData(page)
        setCounts(nextCounts)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(isAppError(err) ? err.message : 'We could not load the setup requests.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // paramsKey is a stable stand-in for params (a fresh object every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, reloadToken])

  // New arrivals, whichever tab is open: the waiting queue's first page, checked on a timer.
  useEffect(() => {
    let cancelled = false
    const check = () => {
      // Checked in a background tab too: that is exactly when an alert is useful.
      setupRequestsApi
        .list({ tab: 'NEW', page: 0, size: 50 })
        .then((page) => {
          if (cancelled) return
          const ids = new Set(page.content.map((request) => request.id))
          if (seenNew.current) {
            const arrived = page.content.filter((request) => !seenNew.current!.has(request.id))
            if (arrived.length > 0) {
              onNewRef.current?.(arrived)
              setReloadToken((token) => token + 1)
            }
          }
          seenNew.current = ids
        })
        .catch(() => {
          // Silent: the main load shows errors; a missed poll is retried in 30 seconds.
        })
    }
    check()
    const timer = window.setInterval(check, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  const refetch = useCallback(() => setReloadToken((token) => token + 1), [])

  /** Puts a just-saved row in place without waiting for a reload. */
  const replace = useCallback((updated: SetupRequest) => {
    setData((current) =>
      current ? { ...current, content: current.content.map((row) => (row.id === updated.id ? updated : row)) } : current,
    )
  }, [])

  return { data, requests: data?.content ?? [], counts, loading, error, refetch, replace }
}
