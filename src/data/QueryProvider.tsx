import { useEffect, useRef, useState, type ReactNode } from 'react'
import { IsRestoringProvider, QueryClientProvider } from '@tanstack/react-query'
import { persistQueryClientRestore, persistQueryClientSubscribe } from '@tanstack/react-query-persist-client'
import { useAuth } from '@/auth/useAuth'
import { CACHE_MAX_AGE_MS, queryClient } from '@/data/queryClient'
import {
  CACHE_BUSTER,
  cacheDatabaseName,
  createQueryPersister,
  deleteCacheDatabase,
  shouldPersistQuery,
} from '@/data/queryPersistence'

/**
 * Provides the query cache, and ties its on-device copy to whoever is signed in.
 *
 * - Signed in: the user's saved cache is restored from IndexedDB before any inventory query runs
 *   (so a screen opened offline shows what was there last time instead of an error), and every
 *   change is written back.
 * - Signed out, or a different user: the previous user's cache is cleared from memory and its
 *   database deleted. A company's stock and costs must not outlive the session on a phone that
 *   someone else may sign in on.
 *
 * Attached imperatively rather than by swapping in `PersistQueryClientProvider` at sign-in: a
 * different provider component would remount the whole app at the moment the login screen is
 * mid-redirect.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const { user, client } = useAuth()
  const databaseName = user ? cacheDatabaseName(client?.id, user.id) : null
  // Which database has finished restoring. Derived rather than toggled, so the very first render
  // after sign-in already counts as restoring and no query slips out to the network before it.
  const [restoredDatabase, setRestoredDatabase] = useState<string | null>(null)
  const isRestoring = databaseName != null && restoredDatabase !== databaseName
  const attachedDatabase = useRef<string | null>(null)

  useEffect(() => {
    const previous = attachedDatabase.current
    if (previous != null && previous !== databaseName) {
      queryClient.clear()
      void deleteCacheDatabase(previous)
    }
    attachedDatabase.current = databaseName
    if (databaseName == null) return

    const { persister, flush, close } = createQueryPersister(databaseName)
    const persistOptions = {
      queryClient,
      persister,
      maxAge: CACHE_MAX_AGE_MS,
      buster: CACHE_BUSTER,
      dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
    }
    let cancelled = false
    let unsubscribe: (() => void) | null = null

    // Writes are batched for a second, so the last second of changes would be lost if the app
    // were closed or reloaded inside it — a phone user opening the stock list and switching
    // straight away. Hiding or leaving the page writes at once.
    const saveNow = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    const saveOnLeave = () => void flush()

    persistQueryClientRestore(persistOptions)
      .catch(() => {
        // A corrupt or unreadable store is not worth blocking the app over: start empty.
      })
      .finally(() => {
        if (cancelled) return
        unsubscribe = persistQueryClientSubscribe(persistOptions)
        document.addEventListener('visibilitychange', saveNow)
        window.addEventListener('pagehide', saveOnLeave)
        setRestoredDatabase(databaseName)
      })

    return () => {
      cancelled = true
      unsubscribe?.()
      document.removeEventListener('visibilitychange', saveNow)
      window.removeEventListener('pagehide', saveOnLeave)
      // Before the next run deletes this database on sign-out: no late write may recreate it.
      close()
    }
  }, [databaseName])

  return (
    <QueryClientProvider client={queryClient}>
      <IsRestoringProvider value={isRestoring}>{children}</IsRestoringProvider>
    </QueryClientProvider>
  )
}
