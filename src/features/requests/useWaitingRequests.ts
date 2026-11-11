import { useEffect } from 'react'
import { useApiQuery } from '@/data/useApiQuery'
import { hasAreas } from '@/features/branches/areas'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { shownRequestNotifications } from '@/features/push/pushDevice'
import { requestsApi } from '@/features/requests/requestsApi'
import type { StockRequest } from '@/features/requests/types'

/** Often enough that the Kitchen's ask reaches the Store's screen in a minute. */
const EVERY_MINUTE = 60_000

/**
 * The requests waiting for this person to fill (STOCK_AREAS_PART_5.md): open, to an area they work in, at the
 * branch they're at (every branch they see, in "All branches"). Only asked at a branch with areas.
 */
export function useWaitingRequests(): { requests: StockRequest[] } {
  const branch = useOptionalWorkingBranch()
  const here = branch && !branch.isAll ? branch.working : null
  const withAreas = (here ? [here] : (branch?.branches ?? [])).some((candidate) => hasAreas(candidate))
  const { data } = useApiQuery({
    queryKey: ['stock-requests', 'waiting', here?.id ?? 'all'],
    queryFn: () => requestsApi.waiting(here?.id),
    fallbackError: "Couldn't load what's been asked for.",
    enabled: withAreas,
    refetchInterval: EVERY_MINUTE,
    refetchOnWindowFocus: true,
  })
  // A notification still showing for a request that's no longer waiting (moved while this phone was off, or the
  // quiet "Moved ✓" never came): it goes once the app knows - each one checked, as it may be another branch's.
  useEffect(() => {
    if (!data) return
    const waiting = new Set(data.map((request) => request.id))
    void shownRequestNotifications().then((shown) => {
      for (const [id, notification] of shown) {
        if (waiting.has(id)) continue
        void requestsApi
          .get(id)
          .then((request) => {
            if (request.status !== 'OPEN' || !request.canFill) notification.close()
          })
          .catch(() => undefined)
      }
    })
  }, [data])

  return { requests: withAreas ? (data ?? []) : [] }
}
