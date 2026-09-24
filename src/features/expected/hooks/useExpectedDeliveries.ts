import { useCallback, useEffect, useState } from 'react'
import { expectedApi } from '@/features/expected/api/expectedApi'
import { expectedCopy } from '@/features/expected/copy'
import type { ExpectedDelivery, ExpectedDeliveryStatus, PageResponse } from '@/features/expected/types'
import { isAppError } from '@/types/api'

/**
 * One page of expected deliveries, newest first.
 *
 * `status` left undefined lists every status — the "All" tab. The list screen asks for OPEN,
 * because the question this feature exists to answer is "what have we got coming?" and a page
 * whose first screenful is last quarter's finished orders does not answer it.
 */
export function useExpectedDeliveries(status: ExpectedDeliveryStatus | undefined, page: number, size: number) {
  const [data, setData] = useState<PageResponse<ExpectedDelivery> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    expectedApi
      .list({ status, page, size })
      .then((response) => {
        if (!cancelled) setData(response)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(isAppError(err) ? err.message : expectedCopy.list.loadFailed)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [status, page, size, reloadToken])

  const refetch = useCallback(() => setReloadToken((token) => token + 1), [])

  /**
   * Puts a record the screen has just changed back in place, without a round trip.
   *
   * Cancel answers with the whole updated record, so re-fetching the page to show one changed
   * badge would be a request whose answer we already hold — and on the OPEN tab it would also
   * make the row vanish mid-gesture, which reads as "did that work?" rather than as "done".
   */
  const replace = useCallback((updated: ExpectedDelivery) => {
    setData((current) =>
      current == null
        ? current
        : {
            ...current,
            content: current.content.map((entry) => (entry.id === updated.id ? updated : entry)),
          },
    )
  }, [])

  return { data, loading, error, refetch, replace }
}
