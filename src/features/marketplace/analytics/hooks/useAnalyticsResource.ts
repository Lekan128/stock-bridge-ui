import { useCallback, useEffect, useRef, useState } from 'react'
import { isAppError } from '@/types/api'

/**
 * The one fetch loop behind all six analytics hooks.
 *
 * Follows `useAnalyticsSummary`/`useMovementsOverTime` exactly — hand-rolled
 * loading/error/data, cancelled-flag cleanup, and a JSON-stringified params key standing
 * in for the fresh object every render produces. There is no react-query in this app and
 * this module does not introduce one.
 *
 * Two things it adds, because this page needs them and the dashboard did not:
 *
 * - `refetch`, so an error state can offer Retry rather than making the operator reload
 *   a page whose date range lives in the URL.
 * - `data` is KEPT across a params change while the next response is in flight. Six
 *   independent requests all restart when the date range moves; blanking every card to a
 *   skeleton on each toggle makes the screen strobe. Callers render the stale numbers at
 *   reduced opacity instead and only fall back to a skeleton on the first load
 *   (`loading && !data`), which is the same condition the dashboard uses.
 */
export interface AnalyticsResource<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useAnalyticsResource<TParams, TData>(
  fetcher: (params: TParams) => Promise<TData>,
  params: TParams,
): AnalyticsResource<TData> {
  const [data, setData] = useState<TData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  // The fetcher is a module-level function in every call site, but holding it in a ref
  // keeps that from being load-bearing: the effect depends only on the params key, so a
  // caller passing an inline arrow cannot turn this into an infinite loop.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const paramsRef = useRef(params)
  paramsRef.current = params
  const paramsKey = JSON.stringify(params)

  const refetch = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetcherRef
      .current(paramsRef.current)
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
  }, [paramsKey, attempt])

  return { data, loading, error, refetch }
}
