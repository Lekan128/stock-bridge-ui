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
  /** The barcode, so a scanner typing into a search box finds the product offline (C4). */
  _barcode: string
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
  return { ...row, _name: row.name.toLowerCase(), _sku: row.sku.toLowerCase(), _barcode: (row.barcode ?? '').toLowerCase() }
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

/**
 * A row as the list should read it (MULTI_BRANCH_UX_PLAN.md §4.3). At a branch: that branch's figure,
 * level and status. In "All branches": the company figure, low when it is low at any branch, out only
 * when every branch is. A row with no figure for the branch (it arrived before the branch existed) is
 * read as holding none there - never as the company's figure, which would overstate the shelf.
 */
function asSeen(row: StoredRow, q: CatalogQuery): StoredRow {
  if (row.branchStock == null) return row
  if (q.branchId) {
    const figure = row.branchStock.find((entry) => entry.branchId === q.branchId)
    return figure
      ? { ...row, quantityOnHand: figure.quantityOnHand, lowStockThreshold: figure.lowStockThreshold ?? null,
          isLowStock: figure.isLowStock === true, stockStatus: figure.stockStatus }
      : { ...row, quantityOnHand: 0, isLowStock: row.lowStockThreshold != null, stockStatus: 'OUT' }
  }
  if (q.allBranches && row.stockStatus !== 'OUT' && row.branchStock.some((entry) => entry.stockStatus !== 'OK')) {
    return { ...row, isLowStock: true, stockStatus: 'LOW' }
  }
  return row
}

function query(q: CatalogQuery): CatalogQueryResult {
  const term = q.search.trim().toLowerCase()
  const counts = { all: 0, OK: 0, LOW: 0, OUT: 0 }
  const priceCounts = { has: 0, none: 0 }
  const price = q.price ?? 'all'
  const matching: StoredRow[] = []

  // A branch's own figures sort differently from the company's: sorted here, after the filters.
  const byBranchQuantity = q.branchId != null && q.sort.field === 'quantityOnHand'
  for (const stored of sortedRows(byBranchQuantity ? 'name' : q.sort.field, q.sort.direction)) {
    const row = asSeen(stored, q)
    if (q.status === 'active' && !row.active) continue
    if (q.status === 'inactive' && row.active) continue
    if (q.categoryId && row.categoryId !== q.categoryId) continue
    if (term && !row._name.includes(term) && !row._sku.includes(term) && !row._barcode.includes(term)) continue
    const priced = row.unitPrice != null
    // Each census is counted under every filter but its own, so a chip says what picking it shows.
    if (q.stockStatus === 'all' || row.stockStatus === q.stockStatus) {
      if (priced) priceCounts.has += 1
      else priceCounts.none += 1
    }
    if (price === 'has' && !priced) continue
    if (price === 'none' && priced) continue
    counts.all += 1
    counts[row.stockStatus] += 1
    if (q.stockStatus !== 'all' && row.stockStatus !== q.stockStatus) continue
    matching.push(row)
  }
  if (byBranchQuantity) {
    const sign = q.sort.direction === 'asc' ? 1 : -1
    matching.sort((a, b) => sign * (a.quantityOnHand - b.quantityOnHand) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
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
    priceCounts,
    incoming: { units: incomingUnits, productCount: incomingProducts },
    catalogSize: rows.size,
    activeCount,
  }
}

function strip({ _name: _n, _sku: _s, _barcode: _b, ...row }: StoredRow): CatalogRow {
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
      // Merged over the stored row: an API product doesn't carry everything the feed does (its
      // barcode, which the scan search in quick mode needs, C4).
      const stored = rows.get(request.product.id)
      if (stored) await upsert([{ ...strip(stored), ...request.product, barcode: request.product.barcode ?? stored.barcode }])
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
