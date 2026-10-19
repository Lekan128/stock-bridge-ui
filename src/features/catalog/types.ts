import type { StockStatusFilter } from '@/features/products/types'

/**
 * One product as the on-device catalogue holds it — `ProductSyncRow` on the API. Exactly what the
 * Inventory list shows, filters and sorts on; costs, descriptions and history stay on the product
 * page, which still asks the server.
 *
 * Nullable fields may be absent rather than null on the wire (the API omits nulls), so compare
 * with `== null`.
 */
export interface CatalogRow {
  id: string
  name: string
  sku: string
  barcode?: string | null
  imageUrl?: string | null
  categoryId?: string | null
  categoryName?: string | null
  unitOfMeasure?: string | null
  packagingUnit?: string | null
  packagingSize?: number | null
  hasMultiplePacks: boolean
  unitPrice?: number | null
  /** The selling price as typed and its unit ("5,000" per "CARTON"), API V47 - for pre-filling a sale offline. */
  unitPriceEntered?: number | null
  unitPriceEnteredUnit?: string | null
  quantityOnHand: number
  incomingQuantity: number
  expectedQuantity?: number | null
  lowStockThreshold?: number | null
  active: boolean
  isLowStock: boolean
  stockStatus: StockStatusFilter
}

export interface SnapshotPage {
  products: CatalogRow[]
  nextAfterId?: string | null
  hasMore: boolean
  /** First page only: where the change feed picks up once every page is in. */
  cursor?: string | null
  /** First page only: roughly how many products the pages will add up to. */
  total?: number | null
}

export interface ChangesPage {
  products: CatalogRow[]
  removedIds: string[]
  cursor: string
  hasMore: boolean
}

/** The Inventory list's selling-price filter. */
export type PriceFilter = 'all' | 'has' | 'none'

export type CatalogSortField = 'name' | 'sku' | 'unitPrice' | 'quantityOnHand' | 'active'

/** The Inventory list's filters, as the worker answers them. */
export interface CatalogQuery {
  search: string
  status: 'all' | 'active' | 'inactive'
  categoryId: string
  stockStatus: StockStatusFilter | 'all'
  /** "Has a price" / "No selling price" (`SELLING_PRICE_PLAN.md` §6.5). Absent is both. */
  price?: PriceFilter
  sort: { field: CatalogSortField; direction: 'asc' | 'desc' }
  offset: number
  limit: number
}

export interface CatalogQueryResult {
  rows: CatalogRow[]
  /** How many rows match every filter. */
  total: number
  /** Per stock chip, under every OTHER filter — what each chip would show if picked. */
  counts: { all: number; OK: number; LOW: number; OUT: number }
  /** Per price filter, under every OTHER filter - the census beside it. */
  priceCounts: { has: number; none: number }
  /** Across the whole catalogue: stock bought and not yet received. */
  incoming: { units: number; productCount: number }
  catalogSize: number
  activeCount: number
}

/** What the worker has stored about the sync itself. */
export interface CatalogMeta {
  /** `snapshot` while the first full copy is still loading; `ready` once it is complete. */
  phase: 'empty' | 'snapshot' | 'ready'
  /** Where the change feed picks up. Set by the snapshot's first page. */
  cursor: string | null
  /** The next snapshot page to fetch, so an interrupted first sync resumes rather than restarts. */
  afterId: string | null
  total: number | null
  syncedAt: number | null
  count: number
}
