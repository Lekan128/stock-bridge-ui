/// <reference lib="webworker" />
import Dexie, { type Table } from 'dexie'
import type { CatalogMeta, CatalogQuery, CatalogQueryResult, CatalogRow, CatalogSortField } from '@/features/catalog/types'

/**
 * The on-device catalogue (INVENTORY_OFFLINE_AND_CHARACTER_PLAN.md, A3), off the main thread.
 *
 * Holds every product in IndexedDB for the next visit, and in memory for answering the Inventory
 * list. A query — search, filters, sort, a window of rows, the chip counts — is one pass over an
 * array sorted once per sort order: a few milliseconds at 100,000 products, and none of it on the
 * thread that draws the page. The page only ever receives the rows it is about to show.
 *
 * Search is a case-insensitive substring match on name and SKU, exactly as the server's
 * `ProductSpecifications` does it, so switching between the two never changes what matches.
 */

interface StoredRow extends CatalogRow {
  /** Lower-cased once, for search. */
  _name: string
  _sku: string
}

class CatalogDatabase extends Dexie {
  products!: Table<CatalogRow, string>
  meta!: Table<CatalogMeta, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({ products: 'id', meta: '' })
  }
}

const EMPTY_META: CatalogMeta = { phase: 'empty', cursor: null, afterId: null, total: null, syncedAt: null, count: 0 }
const META_KEY = 'state'

let db: CatalogDatabase | null = null
let meta: CatalogMeta = { ...EMPTY_META }
const rows = new Map<string, StoredRow>()
/** One array per sort order, built on first use and dropped whenever the data changes. */
const sorted = new Map<string, StoredRow[]>()

const collator = new Intl.Collator(undefined, { sensitivity: 'base' })

function toStored(row: CatalogRow): StoredRow {
  return { ...row, _name: row.name.toLowerCase(), _sku: row.sku.toLowerCase() }
}

function compare(field: CatalogSortField, a: StoredRow, b: StoredRow): number {
  switch (field) {
    case 'name':
      return collator.compare(a.name, b.name)
    case 'sku':
      return collator.compare(a.sku, b.sku)
    case 'quantityOnHand':
      return a.quantityOnHand - b.quantityOnHand
    case 'active':
      return Number(a.active) - Number(b.active)
    case 'unitPrice':
      // Nulls last ascending (and so first descending), as Postgres orders them.
      if (a.unitPrice == null) return b.unitPrice == null ? 0 : 1
      if (b.unitPrice == null) return -1
      return a.unitPrice - b.unitPrice
  }
}

function sortedRows(field: CatalogSortField, direction: 'asc' | 'desc'): StoredRow[] {
  const key = `${field},${direction}`
  let order = sorted.get(key)
  if (!order) {
    const sign = direction === 'asc' ? 1 : -1
    order = [...rows.values()].sort((a, b) => sign * compare(field, a, b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    sorted.set(key, order)
  }
  return order
}

function query(q: CatalogQuery): CatalogQueryResult {
  const term = q.search.trim().toLowerCase()
  const counts = { all: 0, OK: 0, LOW: 0, OUT: 0 }
  const matching: StoredRow[] = []

  for (const row of sortedRows(q.sort.field, q.sort.direction)) {
    if (q.status === 'active' && !row.active) continue
    if (q.status === 'inactive' && row.active) continue
    if (q.categoryId && row.categoryId !== q.categoryId) continue
    if (term && !row._name.includes(term) && !row._sku.includes(term)) continue
    counts.all += 1
    counts[row.stockStatus] += 1
    if (q.stockStatus !== 'all' && row.stockStatus !== q.stockStatus) continue
    matching.push(row)
  }

  let incomingUnits = 0
  let incomingProducts = 0
  let activeCount = 0
  for (const row of rows.values()) {
    if (row.active) activeCount += 1
    if (row.incomingQuantity > 0) {
      incomingUnits += row.incomingQuantity
      incomingProducts += 1
    }
  }

  return {
    rows: matching.slice(q.offset, q.offset + q.limit).map(strip),
    total: matching.length,
    counts,
    incoming: { units: incomingUnits, productCount: incomingProducts },
    catalogSize: rows.size,
    activeCount,
  }
}

function strip({ _name: _n, _sku: _s, ...row }: StoredRow): CatalogRow {
  return row
}

async function saveMeta(patch: Partial<CatalogMeta>): Promise<CatalogMeta> {
  meta = { ...meta, ...patch, count: rows.size }
  await db?.meta.put(meta, META_KEY)
  return meta
}

async function upsert(products: CatalogRow[]): Promise<void> {
  if (products.length === 0) return
  for (const product of products) rows.set(product.id, toStored(product))
  sorted.clear()
  await db?.products.bulkPut(products)
}

async function remove(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  for (const id of ids) rows.delete(id)
  sorted.clear()
  await db?.products.bulkDelete(ids)
}

// ------------------------------------------------------------------------------- messages

type Request =
  | { type: 'init'; dbName: string }
  | { type: 'reset' }
  | { type: 'applySnapshotPage'; products: CatalogRow[]; nextAfterId: string | null; cursor: string | null; total: number | null }
  | { type: 'finishSnapshot'; syncedAt: number }
  | { type: 'applyChanges'; products: CatalogRow[]; removedIds: string[]; cursor: string; syncedAt: number }
  | { type: 'patch'; product: CatalogRow }
  | { type: 'query'; query: CatalogQuery }
  | { type: 'meta' }
  | { type: 'close' }

async function handle(request: Request): Promise<unknown> {
  switch (request.type) {
    case 'init': {
      db = new CatalogDatabase(request.dbName)
      rows.clear()
      sorted.clear()
      meta = (await db.meta.get(META_KEY)) ?? { ...EMPTY_META }
      for (const row of await db.products.toArray()) rows.set(row.id, toStored(row))
      meta.count = rows.size
      return meta
    }
    case 'reset': {
      rows.clear()
      sorted.clear()
      await db?.products.clear()
      meta = { ...EMPTY_META }
      await db?.meta.put(meta, META_KEY)
      return meta
    }
    case 'applySnapshotPage': {
      await upsert(request.products)
      return saveMeta({
        phase: 'snapshot',
        afterId: request.nextAfterId,
        ...(request.cursor != null ? { cursor: request.cursor } : {}),
        ...(request.total != null ? { total: request.total } : {}),
      })
    }
    case 'finishSnapshot':
      return saveMeta({ phase: 'ready', afterId: null, syncedAt: request.syncedAt })
    case 'applyChanges': {
      await upsert(request.products)
      await remove(request.removedIds)
      await saveMeta({ cursor: request.cursor, syncedAt: request.syncedAt })
      return { changed: request.products.length + request.removedIds.length, meta }
    }
    case 'patch': {
      // The answer to a write this phone just made, shown before the feed confirms it.
      if (rows.has(request.product.id)) await upsert([request.product])
      return null
    }
    case 'query':
      return query(request.query)
    case 'meta':
      return meta
    case 'close':
      db?.close()
      db = null
      rows.clear()
      sorted.clear()
      return null
  }
}

self.onmessage = (event: MessageEvent<{ id: number; request: Request }>) => {
  const { id, request } = event.data
  handle(request).then(
    (result) => self.postMessage({ id, result }),
    (error: unknown) => self.postMessage({ id, error: error instanceof Error ? error.message : String(error) }),
  )
}
