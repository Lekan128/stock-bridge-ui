import { api } from '@/api/client'
import type { PageResponse } from '@/features/products/types'
import {
  CATALOG_IDS_BATCH_LIMIT,
  type CatalogParams,
  type MarketplaceCategory,
  type MarketplaceProduct,
  type MarketplaceSettings,
} from '@/features/storefront/types'

/** Splits ids into server-sized batches. Beyond the cap the API answers only the first 100. */
function chunkIds(ids: string[], size = CATALOG_IDS_BATCH_LIMIT): string[][] {
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size))
  return chunks
}

/**
 * Public marketplace endpoints (contract §7). Every call passes `public: true`: these paths are in
 * the backend's PERMIT_ALL_PATHS allowlist and an anonymous shopper has no token, so without the
 * flag a 401 from anywhere in this file would trip the shared client's refresh-and-redirect and
 * throw a browsing visitor onto the login screen.
 */
export const storefrontApi = {
  catalog: (params: CatalogParams) =>
    api
      .get<PageResponse<MarketplaceProduct>>('/api/marketplace/catalog', { params, public: true })
      .then((r) => r.data),

  /**
   * Batch lookup for the anonymous cart. `GET /api/marketplace/catalog?ids=a,b,c` answers a
   * `PageResponse`, not an array — the same handler serves the grid — so this unwraps `content`
   * and hands back a Map keyed by id.
   *
   * A product missing from the response is not an error: it has been unlisted, deactivated or
   * deleted since it was added to the cart, and the caller renders that line as unavailable.
   * Requests are chunked at the server's 100-id cap so a large cart can't silently lose lines.
   */
  catalogByIds: async (ids: string[]): Promise<Map<string, MarketplaceProduct>> => {
    const unique = [...new Set(ids)].filter(Boolean)
    if (unique.length === 0) return new Map()

    const pages = await Promise.all(
      chunkIds(unique).map((chunk) =>
        api
          .get<PageResponse<MarketplaceProduct>>('/api/marketplace/catalog', {
            // `size` is sent explicitly: the endpoint's default page size is 20, and a 40-line
            // cart would otherwise come back truncated with no error to notice.
            params: { ids: chunk.join(','), size: chunk.length },
            public: true,
          })
          .then((r) => r.data),
      ),
    )

    const byId = new Map<string, MarketplaceProduct>()
    for (const page of pages) {
      for (const product of page?.content ?? []) byId.set(product.id, product)
    }
    return byId
  },

  product: (idOrSlug: string) =>
    api.get<MarketplaceProduct>(`/api/marketplace/catalog/${idOrSlug}`, { public: true }).then((r) => r.data),

  /** `limit` defaults to 4 server-side and is capped at 12. */
  related: (idOrSlug: string, limit?: number) =>
    api
      .get<MarketplaceProduct[]>(`/api/marketplace/catalog/${idOrSlug}/related`, {
        params: limit ? { limit } : undefined,
        public: true,
      })
      .then((r) => r.data),

  categories: () =>
    api.get<MarketplaceCategory[]>('/api/marketplace/categories', { public: true }).then((r) => r.data),

  settings: () =>
    api.get<MarketplaceSettings>('/api/marketplace/settings', { public: true }).then((r) => r.data),
}
