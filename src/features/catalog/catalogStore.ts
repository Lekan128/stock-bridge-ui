import Dexie from 'dexie'
import { catalogApi } from '@/features/catalog/catalogApi'
import type { CatalogMeta, CatalogQuery, CatalogQueryResult, CatalogRow } from '@/features/catalog/types'
import type { Product } from '@/features/products/types'
import { isAppError } from '@/types/api'

/**
 * Keeps the on-device catalogue in step with the server (A3) and answers it for the page.
 *
 * - On sign-in: loads what the device already has, then fetches the full catalogue once
 *   (resuming where it stopped if it was interrupted), then only what changed.
 * - While signed in: asks for changes every minute the page is visible, when the device comes
 *   back online, when the page is shown again, and straight after this phone writes something.
 * - On sign-out: stops and deletes the copy (`CatalogProvider`).
 *
 * A module-level store, like the notification store: one copy per signed-in user, read from the
 * Inventory page and written to from wherever stock changes.
 */

export type CatalogPhase =
  /** Not signed in, or not allowed to see products. */
  | 'off'
  /** Opening the device's copy. */
  | 'starting'
  /** The first full copy is still downloading; the Inventory list uses the server meanwhile. */
  | 'loading'
  /** A complete copy is on the device; the Inventory list reads it. */
  | 'ready'
  /** Not enough storage on this device to keep a copy; the list stays on the server. */
  | 'unavailable'

export interface CatalogState {
  phase: CatalogPhase
  /** Products on the device so far, and roughly how many there will be, during the first load. */
  loaded: number
  total: number | null
  /** When the copy was last confirmed against the server. */
  syncedAt: number | null
  /** The last sync attempt couldn't reach the server; the copy may be behind. */
  behind: boolean
  /** Bumped whenever the copy's contents change, so open lists re-ask. */
  version: number
}

const INITIAL: CatalogState = { phase: 'off', loaded: 0, total: null, syncedAt: null, behind: false, version: 0 }
const SYNC_INTERVAL_MS = 60_000
/** Room to leave on the device beyond the copy itself, before deciding a copy won't fit. */
const STORAGE_HEADROOM_BYTES = 20 * 1024 * 1024
/** A generous per-product estimate (row + index + memory), for the fit check. */
const BYTES_PER_PRODUCT = 2048

let state: CatalogState = INITIAL
const listeners = new Set<() => void>()

function setState(patch: Partial<CatalogState>): void {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

export function subscribeCatalog(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getCatalogState(): CatalogState {
  return state
}

// ---------------------------------------------------------------------------- worker calls

let worker: Worker | null = null
let nextCallId = 0
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()

function call<T>(request: Record<string, unknown> & { type: string }): Promise<T> {
  if (!worker) return Promise.reject(new Error('The catalogue is not running.'))
  const id = ++nextCallId
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject })
    worker!.postMessage({ id, request })
  })
}

function startWorker(): void {
  worker = new Worker(new URL('./catalog.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
    const entry = pending.get(event.data.id)
    if (!entry) return
    pending.delete(event.data.id)
    if (event.data.error != null) entry.reject(new Error(event.data.error))
    else entry.resolve(event.data.result)
  }
}

export function queryCatalog(query: CatalogQuery): Promise<CatalogQueryResult> {
  return call<CatalogQueryResult>({ type: 'query', query })
}

// --------------------------------------------------------------------------------- lifecycle

let databaseName: string | null = null
let stopTriggers: (() => void) | null = null

export async function startCatalog(name: string): Promise<void> {
  if (databaseName === name) return
  // Someone else was signed in on this device: their copy is deleted, not just closed.
  await stopCatalog({ deleteData: databaseName != null })
  databaseName = name
  setState({ ...INITIAL, phase: 'starting' })
  startWorker()
  try {
    const meta = await call<CatalogMeta>({ type: 'init', dbName: name })
    if (databaseName !== name) return
    setState({
      phase: meta.phase === 'ready' ? 'ready' : 'loading',
      loaded: meta.count,
      total: meta.total,
      syncedAt: meta.syncedAt,
      version: state.version + 1,
    })
  } catch {
    // IndexedDB unavailable (private mode on some browsers): the list stays on the server.
    setState({ phase: 'unavailable' })
    return
  }
  stopTriggers = attachTriggers()
  void syncCatalog()
}

export async function stopCatalog({ deleteData }: { deleteData: boolean }): Promise<void> {
  const name = databaseName
  databaseName = null
  stopTriggers?.()
  stopTriggers = null
  if (worker) {
    await call({ type: 'close' }).catch(() => undefined)
    worker.terminate()
    worker = null
  }
  for (const entry of pending.values()) entry.reject(new Error('The catalogue was stopped.'))
  pending.clear()
  setState(INITIAL)
  if (deleteData && name) {
    try {
      await Dexie.delete(name)
    } catch {
      // Already gone, or blocked; nothing else is reading it now.
    }
  }
}

function attachTriggers(): () => void {
  const onVisible = () => {
    if (document.visibilityState === 'visible') void syncCatalog()
  }
  const onOnline = () => void syncCatalog()
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', onOnline)
  const timer = window.setInterval(() => {
    if (document.visibilityState === 'visible' && navigator.onLine) void syncCatalog()
  }, SYNC_INTERVAL_MS)
  return () => {
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', onOnline)
    window.clearInterval(timer)
  }
}

// ------------------------------------------------------------------------------------- sync

let syncing = false
let syncAgain = false

/**
 * Brings the copy up to date. Single-flight: a call while one is running runs again afterwards,
 * so a write made mid-sync is never left waiting for the next minute.
 */
export async function syncCatalog(): Promise<void> {
  if (!databaseName || !worker) return
  if (syncing) {
    syncAgain = true
    return
  }
  syncing = true
  const name = databaseName
  try {
    const meta = await loadSnapshotIfNeeded(name)
    if (meta && databaseName === name) await pullChanges(name, meta.cursor)
    if (databaseName === name) setState({ behind: false })
  } catch (error) {
    if (databaseName !== name) return
    if (isAppError(error) && error.status === 400) {
      // The server no longer recognises the cursor: start over with a fresh full copy.
      await call({ type: 'reset' })
      setState({ phase: 'loading', loaded: 0, total: null, version: state.version + 1 })
      syncAgain = true
    } else {
      setState({ behind: true })
    }
  } finally {
    syncing = false
    if (syncAgain && databaseName === name) {
      syncAgain = false
      void syncCatalog()
    }
  }
}

/** The first full copy, resuming from where an interrupted one stopped. */
async function loadSnapshotIfNeeded(name: string): Promise<CatalogMeta | null> {
  let meta = await currentMeta()
  if (meta.phase === 'ready') return meta

  let afterId = meta.phase === 'snapshot' ? meta.afterId : null
  if (afterId == null && meta.phase !== 'empty') {
    meta = await call<CatalogMeta>({ type: 'reset' })
  }
  for (;;) {
    const page = await catalogApi.snapshot(afterId)
    if (databaseName !== name) return null
    if (afterId == null && page.total != null && !(await copyWouldFit(page.total))) {
      await call({ type: 'reset' })
      setState({ phase: 'unavailable' })
      return null
    }
    meta = await call<CatalogMeta>({
      type: 'applySnapshotPage',
      products: page.products,
      nextAfterId: page.nextAfterId ?? null,
      cursor: page.cursor ?? null,
      total: page.total ?? null,
    })
    setState({ loaded: meta.count, total: meta.total })
    if (!page.hasMore) break
    afterId = page.nextAfterId ?? null
  }
  meta = await call<CatalogMeta>({ type: 'finishSnapshot', syncedAt: Date.now() })
  setState({ phase: 'ready', syncedAt: meta.syncedAt, loaded: meta.count, version: state.version + 1 })
  return meta
}

async function pullChanges(name: string, startCursor: string | null): Promise<void> {
  if (startCursor == null) return
  let cursor = startCursor
  for (;;) {
    const page = await catalogApi.changes(cursor)
    if (databaseName !== name) return
    const { changed, meta } = await call<{ changed: number; meta: CatalogMeta }>({
      type: 'applyChanges',
      products: page.products,
      removedIds: page.removedIds,
      cursor: page.cursor,
      syncedAt: Date.now(),
    })
    setState({
      syncedAt: meta.syncedAt,
      loaded: meta.count,
      ...(changed > 0 ? { version: state.version + 1 } : {}),
    })
    cursor = page.cursor
    if (!page.hasMore) break
  }
}

async function currentMeta(): Promise<CatalogMeta> {
  return call<CatalogMeta>({ type: 'meta' })
}

async function copyWouldFit(total: number): Promise<boolean> {
  try {
    const estimate = await navigator.storage?.estimate?.()
    if (!estimate?.quota) return true
    const free = estimate.quota - (estimate.usage ?? 0)
    return free > total * BYTES_PER_PRODUCT + STORAGE_HEADROOM_BYTES
  } catch {
    return true
  }
}

// ------------------------------------------------------------------------------ local writes

/**
 * After this phone writes to a product: show the server's answer at once, then ask the feed,
 * which also picks up anything the write changed elsewhere (low-stock status, expected figures).
 */
export function noteProductChanged(product?: Product): void {
  if (product && worker && state.phase === 'ready') {
    void call({ type: 'patch', product: toCatalogRow(product) }).then(() => setState({ version: state.version + 1 }))
  }
  void syncCatalog()
}

/** A product from any API response, in the catalogue's shape. */
export function toCatalogRow(product: Product): CatalogRow {
  const threshold = product.lowStockThreshold
  const quantity = product.quantityOnHand
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    imageUrl: product.imageUrl,
    categoryId: product.categoryId ?? null,
    categoryName: product.categoryName ?? null,
    unitOfMeasure: product.unitOfMeasure ?? null,
    packagingUnit: product.packagingUnit ?? null,
    packagingSize: product.packagingSize ?? null,
    hasMultiplePacks: product.hasMultiplePacks ?? false,
    unitPrice: product.unitPrice,
    quantityOnHand: quantity,
    incomingQuantity: product.incomingQuantity ?? 0,
    expectedQuantity: product.expectedQuantity ?? null,
    lowStockThreshold: threshold,
    active: product.active,
    isLowStock: product.isLowStock,
    // Same rule as the server's StockStatus.of; the feed's own value replaces this moments later.
    stockStatus: quantity <= 0 ? 'OUT' : threshold != null && quantity <= threshold ? 'LOW' : 'OK',
  }
}

/** A catalogue row in the shape the Inventory table and cards render. */
export function toProduct(row: CatalogRow): Product {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    description: null,
    unitPrice: row.unitPrice ?? null,
    quantityOnHand: row.quantityOnHand,
    costPrice: null,
    incomingQuantity: row.incomingQuantity,
    lowStockThreshold: row.lowStockThreshold ?? null,
    unitOfMeasure: row.unitOfMeasure ?? undefined,
    packagingUnit: row.packagingUnit ?? undefined,
    packagingSize: row.packagingSize ?? null,
    imageUrl: row.imageUrl ?? null,
    preferredVendorName: null,
    categoryId: row.categoryId ?? null,
    categoryName: row.categoryName ?? null,
    active: row.active,
    isLowStock: row.isLowStock,
    createdAt: '',
    updatedAt: '',
    hasMultiplePacks: row.hasMultiplePacks,
    expectedQuantity: row.expectedQuantity ?? undefined,
  }
}
