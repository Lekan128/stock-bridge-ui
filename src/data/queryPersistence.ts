import type { Query } from '@tanstack/react-query'
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'
import Dexie, { type Table } from 'dexie'

/**
 * Where the query cache lives between visits: one IndexedDB database per signed-in user.
 *
 * Per user, not per browser, because the cache holds a company's stock, costs and suppliers. A
 * colleague signing in on the same phone must never be shown it, so the database is named for
 * the company and user, and deleted on logout (`QueryProvider`).
 *
 * IndexedDB rather than localStorage: the cache grows with the catalog, and localStorage is
 * synchronous (it blocks the main thread on every write) and capped at a few megabytes.
 */

/** Bump to discard every device's saved cache, e.g. after a response shape changes. */
export const CACHE_BUSTER = 'a2-v1'

const DB_PREFIX = 'procurepaddy-cache'

export function cacheDatabaseName(clientId: string | undefined, userId: string): string {
  return `${DB_PREFIX}:${clientId ?? 'unknown'}:${userId}`
}

class CacheDatabase extends Dexie {
  kv!: Table<string, string>

  constructor(name: string) {
    super(name)
    // Out-of-line keys: the persister stores one serialised blob under one key.
    this.version(1).stores({ kv: '' })
  }
}

/** One saved snapshot of the whole cache, under one key. */
const SNAPSHOT_KEY = 'query-cache'

/**
 * How long a burst of cache changes that bring no new answer (queries starting to fetch, statuses
 * flipping) is batched before one write; new answers are written at once. Short on purpose: browsers abort IndexedDB writes started while a page is being torn
 * down, so a write still waiting when the app is closed outright is lost. `flush()` on hiding the
 * page covers a phone switching apps, where the page stays alive long enough to finish.
 */
const WRITE_DELAY_MS = 300

/**
 * A persister for one user's database, with `flush()` and `close()`.
 *
 * Written here rather than taken from `@tanstack/query-async-storage-persister`, whose throttle
 * also swallows a save forced on the way out: a phone user who opened the stock list and switched
 * away inside that second lost it, because the "save now" from the page-hide handler was itself
 * deferred past the unload. Here the latest snapshot is held in memory and written as soon as it
 * holds a new answer, otherwise once a burst settles, and immediately by `flush()`.
 *
 * `close()` exists for logout. After it, every write is dropped and the connection is shut, so a
 * write still pending can't reopen — and so recreate — the database a moment after it is deleted.
 */
export function createQueryPersister(databaseName: string) {
  const db = new CacheDatabase(databaseName)
  let closed = false
  let pending: PersistedClient | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  async function flush(): Promise<void> {
    if (timer != null) {
      clearTimeout(timer)
      timer = null
    }
    const snapshot = pending
    pending = null
    if (snapshot == null || closed) return
    try {
      await db.kv.put(JSON.stringify(snapshot), SNAPSHOT_KEY)
    } catch {
      // Quota or a closing database: the next change writes again, and nothing on screen depends
      // on this having succeeded.
    }
  }

  /** The newest answer from the server that has been written (a query's `dataUpdatedAt`). */
  let savedAnswerAt = 0

  const persister: Persister = {
    // A new answer from the server is written at once; everything else (a query starting to
    // fetch, a status flipping) waits for the batch. Batching answers too (until Phase H) left a
    // screen's data unsaved for its first 300 ms, and a tab lost inside that window - the phone
    // killing it, a reload - came back offline with nothing: `flush()` on the way out does not
    // survive a reload.
    persistClient: async (client) => {
      pending = client
      const answerAt = client.clientState.queries.reduce((newest, query) => Math.max(newest, query.state.dataUpdatedAt), 0)
      if (answerAt > savedAnswerAt) {
        savedAnswerAt = answerAt
        void flush()
        return
      }
      timer ??= setTimeout(() => void flush(), WRITE_DELAY_MS)
    },
    restoreClient: async () => {
      if (closed) return undefined
      const raw = await db.kv.get(SNAPSHOT_KEY)
      return raw == null ? undefined : (JSON.parse(raw) as PersistedClient)
    },
    removeClient: async () => {
      if (!closed) await db.kv.delete(SNAPSHOT_KEY)
    },
  }

  return {
    persister,
    flush,
    close: () => {
      closed = true
      pending = null
      if (timer != null) clearTimeout(timer)
      timer = null
      db.close()
    },
  }
}

export async function deleteCacheDatabase(databaseName: string): Promise<void> {
  try {
    await Dexie.delete(databaseName)
  } catch {
    // Blocked or already gone. The next sign-in under this name overwrites it either way.
  }
}

/**
 * Which queries are worth keeping on the device: any that hold an answer, and not one-off
 * searches — a typed search term is a key nobody asks for twice, and keeping every one of them
 * would fill the store with near-duplicate pages of the catalog.
 *
 * "Holds an answer", not "succeeded last time" (found by the Phase H chaos suite): offline, a
 * screen's refetch fails and its query turns to `error` while keeping the data it had. Persisting
 * only `success` then dropped that saved copy at the next save, so a phone that stayed offline —
 * the tab closed and reopened — opened the product it had just been working on as "You're offline".
 */
export function shouldPersistQuery(query: Query): boolean {
  if (query.state.data === undefined) return false
  if (query.meta?.persist === false) return false
  return true
}
