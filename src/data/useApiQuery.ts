import { useCallback, useRef, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { isTransientFailure } from '@/data/queryClient'
import { isAppError } from '@/types/api'

/**
 * While the last attempt couldn't reach the server, try again this often. The browser's "online"
 * event only fires when the DEVICE comes back; a server that was unreachable while the phone kept
 * its signal (a dead zone with bars, a server waking from a cold start) would otherwise leave a
 * saved copy on screen until the user navigated away.
 */
const RECOVERY_INTERVAL_MS = 30_000

export interface ApiQueryOptions<T> {
  queryKey: QueryKey
  queryFn: () => Promise<T>
  /** Shown when the failure carries no message of its own. */
  fallbackError: string
  enabled?: boolean
  /**
   * Only ever return data fetched from the server since this screen opened — never a cached copy.
   *
   * For screens that SEED A FORM from the answer (the product edit form). A cached product may be
   * one another phone has since changed; filling the form from it and saving would quietly write
   * the old values back over theirs. Offline, such a screen shows the "you're offline" error,
   * which is right: editing a shared record is online-only.
   */
  requireFresh?: boolean
  /** Keep the previous answer on screen while a new filter or page loads (lists). */
  keepPrevious?: boolean
  /** Override the client default of 0 (revalidate on every mount). */
  staleTime?: number
  refetchInterval?: number | false
  /** Refetch when the tab is shown again. Off by default, like the hooks this replaces. */
  refetchOnWindowFocus?: boolean
  /** Keep this answer on the device between visits (the default). */
  persist?: boolean
}

export interface ApiQueryResult<T> {
  data: T | undefined
  /** Nothing to show yet, and an answer is on its way. Drives skeletons. */
  loading: boolean
  /** Any request in flight, including a background refresh of data already on screen. */
  fetching: boolean
  /**
   * Set when there is nothing useful to show, or the server gave a real answer (a 4xx). A failure
   * to REACH the server while saved data is on screen is not an error to the reader — see
   * `showingSaved` — so it is not reported here.
   */
  error: string | null
  /** On screen is a saved answer, because the latest attempt couldn't reach the server. */
  showingSaved: boolean
  /** When the data on screen was fetched (epoch ms), or null if there is none. */
  updatedAt: number | null
  refetch: () => void
  setData: (updater: T | ((current: T | undefined) => T | undefined)) => void
}

/**
 * The one shape every cached inventory hook is built on (INVENTORY_OFFLINE_AND_CHARACTER_PLAN.md,
 * A2). It translates TanStack Query's state into the `data / loading / error / refetch` shape the
 * hand-written hooks always returned, so the pages consuming them don't change — plus the two
 * facts a cache adds: whether what's on screen is a saved copy, and from when.
 */
export function useApiQuery<T>(options: ApiQueryOptions<T>): ApiQueryResult<T> {
  const {
    queryKey,
    queryFn,
    fallbackError,
    enabled = true,
    requireFresh = false,
    keepPrevious = false,
    staleTime,
    refetchInterval,
    refetchOnWindowFocus,
    persist = true,
  } = options
  const queryClient = useQueryClient()
  // When this screen opened. `requireFresh` accepts only data newer than this.
  const [openedAt] = useState(() => Date.now())

  const query = useQuery({
    queryKey,
    queryFn,
    enabled,
    staleTime,
    refetchInterval: (current) =>
      isTransientFailure(current.state.error) ? RECOVERY_INTERVAL_MS : (refetchInterval ?? false),
    refetchOnWindowFocus,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
    refetchOnMount: requireFresh ? 'always' : true,
    meta: { persist },
  })

  const data = !requireFresh || query.dataUpdatedAt >= openedAt ? query.data : undefined
  const failure = query.error
  const transient = failure != null && isTransientFailure(failure)
  const error =
    failure != null && !(data !== undefined && transient)
      ? isAppError(failure)
        ? failure.message
        : fallbackError
      : null

  // Stable across renders, like the `refetch`/setters of the hooks this replaces, so callers can
  // keep them in effect dependency lists.
  const keyRef = useRef(queryKey)
  keyRef.current = queryKey
  const refetch = useCallback(() => {
    void queryClient.refetchQueries({ queryKey: keyRef.current, exact: true })
  }, [queryClient])
  const setData = useCallback(
    (updater: T | ((current: T | undefined) => T | undefined)) => {
      queryClient.setQueryData<T>(keyRef.current, updater as never)
    },
    [queryClient],
  )

  return {
    data,
    loading: enabled && data === undefined && error == null && (query.isPending || query.isFetching),
    fetching: query.isFetching,
    error,
    showingSaved: data !== undefined && transient,
    updatedAt: data !== undefined && query.dataUpdatedAt > 0 ? query.dataUpdatedAt : null,
    refetch,
    setData,
  }
}
