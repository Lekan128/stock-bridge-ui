import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { notificationsApi } from '@/features/notifications/api/notificationsApi'
import type { ServerNotification } from '@/features/notifications/types'

export interface ServerNotificationsState {
  notifications: ServerNotification[]
  unreadCount: number
  loading: boolean
  error: string | null
  markRead: (id: string) => void
  markAllRead: () => void
  refetch: () => void
}

/**
 * ===========================================================================================
 * Server notifications — the bell's second source (M7).
 * ===========================================================================================
 * `useBellNotifications` merges whatever this returns with the client-side low-stock alerts, so
 * this file owns fetching, polling, read-state and nothing about presentation.
 *
 * **Why a module-level store instead of a plain hook.** The topbar bell is the only consumer
 * today, but the obvious next ones (an unread count on a nav item, a notifications page) would
 * each start their own poll and each hold their own divergent read-state. The natural fix is a
 * provider — except mounting one means editing `AppLayout`, which this module does not own. A
 * tiny external store subscribed to via `useSyncExternalStore` gets the same single-poll,
 * single-truth behaviour with no change to the shell, and survives the bell unmounting (a route
 * change that re-mounts the topbar no longer refetches or flashes an empty panel).
 *
 * **Why failure is silent.** This renders in the chrome of every authenticated page. A
 * notifications endpoint having a bad day must not put an error banner above every screen in the
 * app, so `error` is set for diagnostics and the bell shows its "all caught up" state instead.
 */

/**
 * Matches the low-stock poll in `LowStockAlertsContext` deliberately: two independent bell
 * sources refreshing on different cadences would make the badge jump at unexplainable moments.
 */
const POLL_INTERVAL_MS = 3 * 60 * 1000

/** The bell renders six rows; a page of 20 is enough to survive a burst without paging in the chrome. */
const PAGE_SIZE = 20

interface StoreState {
  notifications: ServerNotification[]
  unreadCount: number
  loading: boolean
  error: string | null
}

const INITIAL_STATE: StoreState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
}

let state: StoreState = INITIAL_STATE
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function setState(patch: Partial<StoreState>): void {
  state = { ...state, ...patch }
  emit()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): StoreState {
  return state
}

// Guards against a poll tick landing on top of an in-flight request (a slow network plus a
// manual refetch would otherwise interleave two responses and the older one could win).
let inFlight: Promise<void> | null = null

function load(): Promise<void> {
  if (inFlight) return inFlight

  if (state.notifications.length === 0) setState({ loading: true })

  inFlight = Promise.all([notificationsApi.list({ page: 0, size: PAGE_SIZE }), notificationsApi.unreadCount()])
    .then(([page, unreadCount]) => {
      setState({ notifications: page.content, unreadCount, loading: false, error: null })
    })
    .catch(() => {
      // Kept out of the UI on purpose — see the note at the top of this file.
      setState({ loading: false, error: 'Notifications are unavailable right now.' })
    })
    .finally(() => {
      inFlight = null
    })

  return inFlight
}

let subscriberCount = 0
let timer: ReturnType<typeof setInterval> | null = null

function startPolling(): void {
  if (timer !== null) return
  void load()
  // TODO(future): this polls. When ProcurePal has dispatch riders, order events should be
  // pushed (FCM/SMS/WhatsApp) to ProcurePal staff and the assigned rider instead.
  timer = setInterval(() => void load(), POLL_INTERVAL_MS)
}

function stopPolling(): void {
  if (timer !== null) clearInterval(timer)
  timer = null
}

function reset(): void {
  stopPolling()
  state = INITIAL_STATE
  emit()
}

/** Optimistic: the row greys out immediately, and a failure quietly re-syncs from the server. */
function markRead(id: string): void {
  const target = state.notifications.find((notification) => notification.id === id)
  if (!target || target.readAt !== null) return

  const previous = state
  setState({
    notifications: state.notifications.map((notification) =>
      notification.id === id ? { ...notification, readAt: new Date().toISOString() } : notification,
    ),
    unreadCount: Math.max(0, state.unreadCount - 1),
  })

  notificationsApi.markRead(id).catch(() => {
    setState({ notifications: previous.notifications, unreadCount: previous.unreadCount })
    void load()
  })
}

function markAllRead(): void {
  if (state.unreadCount === 0 && state.notifications.every((notification) => notification.readAt !== null)) return

  const previous = state
  const now = new Date().toISOString()
  setState({
    notifications: state.notifications.map((notification) =>
      notification.readAt === null ? { ...notification, readAt: now } : notification,
    ),
    unreadCount: 0,
  })

  notificationsApi.markAllRead().catch(() => {
    setState({ notifications: previous.notifications, unreadCount: previous.unreadCount })
    void load()
  })
}

/**
 * `/app/marketplace/orders/x?tab=y` and `/app/marketplace/orders/x` are the same destination as
 * far as "did the operator open this notification" is concerned.
 */
function linkMatchesPath(link: string, pathname: string): boolean {
  const linkPath = link.split(/[?#]/)[0].replace(/\/+$/, '')
  const currentPath = pathname.replace(/\/+$/, '')
  return linkPath === currentPath
}

export function useServerNotifications(): ServerNotificationsState {
  const { isAuthenticated } = useAuth()
  const snapshot = useSyncExternalStore(subscribe, getSnapshot)
  const { pathname } = useLocation()

  useEffect(() => {
    if (!isAuthenticated) {
      reset()
      return
    }

    subscriberCount += 1
    if (subscriberCount === 1) startPolling()

    return () => {
      subscriberCount -= 1
      if (subscriberCount === 0) stopPolling()
    }
  }, [isAuthenticated])

  /**
   * Reading a notification is *arriving at what it points to*, not the click itself.
   *
   * The bell renders each row as a `<Link>` and hands the component no per-row callback, so this
   * marks read on navigation instead: any unread notification whose `link` is the page now on
   * screen is settled. That covers the click, and it also covers the operator who reaches the
   * order from the queue — in both cases they have seen it, and a badge that still claims
   * otherwise is a lie.
   */
  useEffect(() => {
    if (!isAuthenticated) return
    for (const notification of snapshot.notifications) {
      if (notification.readAt === null && notification.link && linkMatchesPath(notification.link, pathname)) {
        markRead(notification.id)
      }
    }
  }, [pathname, snapshot.notifications, isAuthenticated])

  const refetch = useCallback(() => {
    void load()
  }, [])

  return {
    notifications: snapshot.notifications,
    unreadCount: snapshot.unreadCount,
    loading: snapshot.loading,
    error: snapshot.error,
    markRead,
    markAllRead,
    refetch,
  }
}
