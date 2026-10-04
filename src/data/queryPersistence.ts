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
 * How long a burst of cache changes (a screen's worth of queries landing) is batched before one
 * write. Short on purpose: browsers abort IndexedDB writes started while a page is being torn
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
 * deferred past the unload. Here the latest snapshot is held in memory, written once a burst
 * settles, and written immediately by `flush()`.
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

  const persister: Persister = {
    persistClient: async (client) => {
      pending = client
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
 * Which queries are worth keeping on the device. Only successful answers, and not one-off
 * searches: a typed search term is a key nobody asks for twice, and keeping every one of them
 * would fill the store with near-duplicate pages of the catalog.
 */
export function shouldPersistQuery(query: Query): boolean {
  if (query.state.status !== 'success') return false
  if (query.meta?.persist === false) return false
  return true
}
