import { api } from '@/api/client'
import type {
  VendorCataloguePage,
  VendorCatalogueProduct,
  VendorMarketplaceDetailsPayload,
} from '@/features/vendor/types'

/**
 * A seller's own catalogue — its products, their listing state, and where each stands with
 * moderation.
 *
 * <h2>What this API can and cannot do, and why the split is where it is</h2>
 * It can list, it can flip the seller's own `listed` flag, and it can set the four marketplace
 * facets of a product it owns — brand, unit of measure, category and minimum order quantity.
 * It CANNOT create a product, or change its name, price, photo or SKU: that is
 * `/api/products`, which every tenant already has, and which is where the moderation stamp is
 * applied at creation. Editing identity fields there is also the RESUBMISSION path for a
 * rejected listing: editing the product IS the resubmission, there is no separate button and
 * no endpoint to add one. The catalogue screen therefore links to the ordinary product form
 * rather than duplicating it.
 *
 * <p>Brand and unit of measure are the exception to that split, and the reason the split is
 * where it is: they are identity fields, but `/api/products` has never carried them. Setting
 * them re-triggers moderation exactly as a name change does — the server shares one service
 * between this route and the operator's, so there is one ruling rather than two.
 */
const BASE = '/api/vendor/catalogue'

export const vendorCatalogueApi = {
  products: (params: { q?: string; listed?: boolean; page: number; size: number }) =>
    api.get<VendorCataloguePage>(`${BASE}/products`, { params }).then((r) => r.data),

  /**
   * Put one product up for sale, or take it down.
   *
   * Does not make it visible on its own, and is not meant to — the public catalogue needs
   * this flag AND an APPROVED moderation status, and only one of the two is the seller's.
   * Listing a PENDING product is sensible ("sell it the moment you clear it") and the server
   * allows it.
   */
  setListing: (productId: string, listed: boolean) =>
    api.post<VendorCatalogueProduct>(`${BASE}/products/${productId}/listing`, { listed }).then((r) => r.data),

  /**
   * Brand, unit of measure, category and minimum order quantity, on the caller's own product.
   *
   * ⚠️ Changing brand or unit of measure takes the listing off the storefront until it is
   * approved again. Any screen calling this with either field must have said so first — see
   * `ReviewImpactNotice` and `ReviewImpactDialog`, which is the pattern the product form uses.
   *
   * <p>404 means the product is not the caller's: the server resolves it against the caller's
   * own client id and never against anything in the request, so another seller's id is
   * indistinguishable from one that does not exist. 403 means the company does not sell at all.
   */
  updateMarketplaceDetails: (productId: string, payload: VendorMarketplaceDetailsPayload) =>
    api
      .put<VendorCatalogueProduct>(`${BASE}/products/${productId}/marketplace-details`, payload)
      .then((r) => r.data),
}
