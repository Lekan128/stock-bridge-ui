import Dexie, { type Table } from 'dexie'

/**
 * Half-finished forms kept on the phone (INVENTORY_OFFLINE_AND_CHARACTER_PLAN.md, A5): Record a
 * delivery and New product.
 *
 * Unlike stock writes these are never sent on their own. Both depend on the server checking them
 * first — a delivery becomes an import the person previews and confirms, a product gets its SKU
 * and its duplicate checks — so a draft only keeps the typing safe through a dead spot, a reload
 * or a closed tab, and the person submits it once there is a connection.
 *
 * One small database per signed-in user, deleted on logout (after the logout guard has said so).
 */

export interface StoredDraft<T = unknown> {
  key: string
  value: T
  savedAt: number
}

class DraftDatabase extends Dexie {
  drafts!: Table<StoredDraft, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({ drafts: 'key' })
  }
}

let db: DraftDatabase | null = null
let databaseName: string | null = null
let keys = new Set<string>()
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function subscribeDrafts(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** How many drafts this user has on the phone — for the logout guard. */
export function getDraftCount(): number {
  return keys.size
}

export async function openDrafts(name: string): Promise<void> {
  if (databaseName === name) return
  closeDrafts()
  databaseName = name
  db = new DraftDatabase(name)
  try {
    keys = new Set(await db.drafts.toCollection().primaryKeys())
  } catch {
    keys = new Set()
  }
  emit()
}

export function closeDrafts(): void {
  db?.close()
  db = null
  databaseName = null
  keys = new Set()
  emit()
}

/** Every draft gone, for good — logout, after the guard. */
export async function deleteAllDrafts(): Promise<void> {
  const name = databaseName
  closeDrafts()
  if (name) await Dexie.delete(name).catch(() => undefined)
}

export async function loadDraft<T>(key: string): Promise<StoredDraft<T> | null> {
  if (!db) return null
  try {
    return ((await db.drafts.get(key)) as StoredDraft<T> | undefined) ?? null
  } catch {
    return null
  }
}

/** Every draft on the phone, newest first — for the sync centre's "Unfinished forms" (A6). */
export async function listDrafts(): Promise<StoredDraft[]> {
  if (!db) return []
  try {
    return (await db.drafts.toArray()).sort((a, b) => b.savedAt - a.savedAt)
  } catch {
    return []
  }
}

export async function saveDraft<T>(key: string, value: T): Promise<number> {
  const savedAt = Date.now()
  if (!db) return savedAt
  try {
    await db.drafts.put({ key, value, savedAt })
    if (!keys.has(key)) {
      keys = new Set(keys).add(key)
      emit()
    }
  } catch {
    // Storage full or unavailable: the form keeps working, it just isn't kept.
  }
  return savedAt
}

export async function deleteDraft(key: string): Promise<void> {
  if (keys.has(key)) {
    keys = new Set(keys)
    keys.delete(key)
    emit()
  }
  await db?.drafts.delete(key).catch(() => undefined)
}

/** Whether the drafts for the signed-in user are open — a form waits for this before it looks. */
export function draftsReady(): boolean {
  return db != null
}
