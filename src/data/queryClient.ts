import { QueryClient } from '@tanstack/react-query'
import { isAppError } from '@/types/api'

/**
 * The one cache every inventory read goes through (INVENTORY_OFFLINE_AND_CHARACTER_PLAN.md, A2).
 *
 * The defaults reproduce what the hand-written hooks did before — fetch every time a screen
 * mounts, never on window focus — with one difference that is the whole point: the last answer
 * is on screen immediately, from memory or from IndexedDB, while the fresh one loads.
 */

/** How long a cached answer is kept, in memory and on disk. Matches the persister's `maxAge`. */
export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * A failure that says nothing about whether the data is still right: no answer at all, or the
 * server erroring. Cached data stays on screen through these; a 4xx (gone, forbidden) does not.
 */
export function isTransientFailure(error: unknown): boolean {
  return isAppError(error) && (error.status === 0 || error.status >= 500)
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Try the network even when the device claims to be offline (`navigator.onLine` lies in
      // both directions), and answer from the cache when it fails.
      networkMode: 'offlineFirst',
      // Every mount revalidates, exactly like the old fetch-in-useEffect hooks — so nothing ever
      // shows a cached figure without also asking for the current one.
      staleTime: 0,
      gcTime: CACHE_MAX_AGE_MS,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      // A dead spot or a cold server gets two quick retries while online. Offline, fail at once
      // and show what's saved; a 4xx is an answer, never retried.
      retry: (failureCount, error) => isTransientFailure(error) && navigator.onLine && failureCount < 2,
    },
  },
})
