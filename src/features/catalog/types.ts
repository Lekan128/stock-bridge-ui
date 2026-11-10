import type { AreaFigure, BranchFigure } from '@/features/branches/types'
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
  /**
   * Multiple branches (V52): this product at each branch the person sees, so the list can show any of
   * them offline. The fields above stay the company's. Absent at a one-branch company (`== null`).
   */
  branchStock?: BranchFigure[]
  /** Areas inside a branch (V60): this product in each area of those branches that have areas. */
  areaStock?: AreaFigure[]
  /** The product's own units (UNITS_PLAN.md Part 1, V82), so the phone offers "Derica" offline. */
  measures?: { name: string; size: number; hidden?: boolean }[]
  /** Where its stock-outs and counts start (Part 2). */
  usedInUnit?: string | null
  /** The units a count of it opens in (V84). Absent: the default. */
  countIn?: string[] | null
  /** When each area last counted it, a branch's only area too, and as typed (2026-11-10). */
  counts?: { areaId: string; at: string; countedAs?: { unit: string; quantity: number }[] }[] | null
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
  /**
   * Multiple branches (MULTI_BRANCH_UX_PLAN.md §4.3): read every row as this branch holds it. With
   * `allBranches`, the company figure, and a product low at any branch counts as low.
   */
  branchId?: string
  allBranches?: boolean
  /**
   * Areas (STOCK_AREAS_PART_3_6.md): read every row as these areas of the branch hold it - their figures
   * summed; out when they hold none, never "low" (an area has no level of its own until Part 8).
   */
  areaIds?: string[]
  /** In an area view, list the products those areas have never had as well ("Show them"). */
  showOthers?: boolean
  /**
   * A count of one area (STOCK_SHEETS_AND_AREA_COUNT_PLAN.md Part 5): only the rows that area has counted since
   * `since` (`counted: true`, "Counted today"), or only those it hasn't (`false`, "To count").
   */
  countedInArea?: { areaId: string; since: number; counted: boolean }
  /** Only what's there - low or not - nothing at 0: the count list (2026-11-10). */
  onlyHeld?: boolean
}

export interface CatalogQueryResult {
  /**
   * In an area view (Part 3.6): how many products matching the other filters the chosen areas have never had -
   * left out of the list and the chips unless searched for or shown ("14 other products aren't in the Kitchen").
   */
  elsewhere?: number
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
  /** The row shape the copy was taken in; absent for copies older than formats. */
  rowFormat?: number
}

/**
 * The row shape this app reads. Raise it when rows gain a field the app relies on, so a phone's copy taken
 * before is downloaded afresh: the change feed only sends products that changed, so old rows never gain it.
 * 2: area figures say whether the area has had the product (`carried`, Part 3.6).
 * 3: a product's own units and where its stock-outs start (UNITS_PLAN.md Parts 1-2).
 */
export const CATALOG_ROW_FORMAT = 3
