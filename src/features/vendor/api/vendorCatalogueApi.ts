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
 * It can list, it can flip the seller's own `listed` flag, and it can set three marketplace
 * facets of a product it owns — brand, category and minimum order quantity. It CANNOT create a
 * product, or change its name, price, photo or SKU: that is `/api/products`, which every tenant
 * already has, and which is where the moderation stamp is applied at creation. Editing identity
 * fields there is also the RESUBMISSION path for a rejected listing: editing the product IS the
 * resubmission, there is no separate button and no endpoint to add one. The catalogue screen
 * therefore links to the ordinary product form rather than duplicating it.
 *
 * <p>Brand is the exception to that split, and the reason the split is where it is: it is an
 * identity field, but `/api/products` has never carried it. Setting it re-triggers moderation
 * exactly as a name change does — the server shares one service between this route and the
 * operator's, so there is one ruling rather than two.
 *
 * <p>Unit of measure USED to be here alongside brand. It moved to `/api/products`, so it now
 * saves in the same request as everything else, for every tenant — not just a seller.
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
   * Brand, category and minimum order quantity, on the caller's own product.
   *
   * ⚠️ Changing brand takes the listing off the storefront until it is approved again. Any
   * screen calling this with a brand change must have said so first — see `ReviewImpactNotice`
   * and `ReviewImpactDialog`, which is the pattern the product form uses.
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
