/**
 * Public marketplace types.
 *
 * M2 (the app shell) seeded this file because the storefront header's category menu and the
 * CartContext's price hydration both need the catalog shapes before the catalog UI exists.
 * M4 owns the storefront pages and should EXTEND this file (filters, related products, facets)
 * rather than replace what is here — `CartContext` and `StorefrontHeader` import from it.
 */

/**
 * `product_categories` (contract §4.4). Global, ProcurePal-managed, one level of nesting.
 *
 * `parentId` is optional, not just nullable: the API runs with
 * `spring.jackson.default-property-inclusion: non_null`, so a top-level category omits the key
 * entirely and it arrives as `undefined`. Anything grouping by parent must treat undefined and
 * null identically — see `topLevelCategories` below, which is the one place that does.
 */
export interface MarketplaceCategory {
  id: string
  name: string
  slug: string
  parentId?: string | null
  sortOrder: number
  active: boolean
  /** Present when the API returns counts; the header menu renders without it. */
  productCount?: number
}

/** Top-level entries only, in the order ProcurePal sorted them. */
export function topLevelCategories(categories: MarketplaceCategory[]): MarketplaceCategory[] {
  return categories.filter((category) => !category.parentId)
}

/**
 * Who is selling something, as the public catalog exposes them.
 *
 * Name and logo only. The API deliberately withholds the seller's email, phone and address —
 * a vendor agreed to sell through the marketplace, not to publish their contact details to
 * anonymous visitors — so there is nothing else here to render and nothing else to ask for.
 *
 * `platformOwner` distinguishes ProcurePal's own stock from a third party's. It is what lets a
 * tile say "Sold by ProcurePal" rather than rendering the operator as one vendor among the rest.
 */
export interface MarketplaceSeller {
  id: string
  name: string
  slug: string | null
  logoUrl: string | null
  platformOwner: boolean
  /**
   * Live listings under this seller. Populated on `/api/marketplace/sellers` and the storefront
   * header; always 0 on the copy embedded in a product tile, which never shows it.
   */
  productCount: number
}

/** A product as the public catalog exposes it (contract §4.5 + §7). */
export interface MarketplaceProduct {
  id: string
  name: string
  sku: string
  slug: string | null
  description: string | null
  brand: string | null
  unitPrice: number
  imageUrl: string | null
  unitOfMeasure: string | null
  minOrderQuantity: number
  quantityOnHand: number
  /** Out-of-stock items are still listed but not purchasable (contract §10). */
  inStock: boolean
  categoryId: string | null
  categoryName: string | null
  /**
   * Null only if the seller row vanished between the catalog query and the projection — the UI
   * renders such a tile unattributed rather than failing the page.
   */
  seller: MarketplaceSeller | null
}

export type CatalogSort = 'RELEVANCE' | 'PRICE_ASC' | 'PRICE_DESC' | 'NAME_ASC' | 'NEWEST'

export const CATALOG_SORTS: readonly CatalogSort[] = [
  'RELEVANCE',
  'PRICE_ASC',
  'PRICE_DESC',
  'NAME_ASC',
  'NEWEST',
]

/**
 * `RELEVANCE` is deliberately labelled "Recommended": server-side it is in-stock-first-then-name,
 * not text ranking, and calling it "Relevance" would promise a search-quality behaviour the
 * endpoint does not implement (contract §7).
 */
export const CATALOG_SORT_LABELS: Record<CatalogSort, string> = {
  RELEVANCE: 'Recommended',
  PRICE_ASC: 'Price: low to high',
  PRICE_DESC: 'Price: high to low',
  NAME_ASC: 'Name: A to Z',
  NEWEST: 'Newest first',
}

export const DEFAULT_CATALOG_SORT: CatalogSort = 'RELEVANCE'

export function isCatalogSort(value: string | null | undefined): value is CatalogSort {
  return !!value && (CATALOG_SORTS as readonly string[]).includes(value)
}

export interface CatalogParams {
  q?: string
  categoryId?: string
  /**
   * "Only this seller". Narrows the server's active-seller pin rather than replacing it, so an id
   * naming a suspended vendor or a buying company returns an empty grid rather than their stock.
   * Powers both the "Sold by" filter and the per-vendor storefront page.
   */
  sellerId?: string
  minPrice?: number
  maxPrice?: number
  /** Hides everything with `quantityOnHand = 0`. Off by default — see contract §10. */
  inStockOnly?: boolean
  sort?: CatalogSort
  page?: number
  size?: number
  /**
   * Comma-separated product ids for the cart's batch lookup. When present the server ignores
   * every other filter and answers with exactly those rows — still as a `PageResponse`, not an
   * array. Capped at 100 ids per request (`CATALOG_IDS_BATCH_LIMIT`).
   */
  ids?: string
}

/** Server-side cap on `?ids=`. Callers must chunk beyond this rather than truncate. */
export const CATALOG_IDS_BATCH_LIMIT = 100

/**
 * Public subset of `marketplace_settings` (contract §4.10). Drives the delivery-fee messaging on
 * the storefront and the support contact in the footer.
 */
export interface MarketplaceSettings {
  deliveryFee: number
  freeDeliveryThreshold: number
  minimumOrderValue: number
  payOnDeliveryEnabled: boolean
  supportPhone: string | null
  supportEmail: string | null
}
