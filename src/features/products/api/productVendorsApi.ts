import { api } from '@/api/client'
import type {
  PriceTierPayload,
  ProductVendor,
  ProductVendorPriceTier,
  ProductVendorUpdatePayload,
} from '@/features/products/vendors/types'

/**
 * `/api/products/{productId}/vendors` — the per-product vendor lines (`ProductVendor`), NOT the
 * company's vendor directory (`vendorsApi`, `/api/company-vendors`). See
 * `features/products/vendors/types.ts` for how the two relate.
 *
 * `{vendorId}` in every path below is the `ProductVendor` row's own `id` — the same "address a
 * resource by its own primary key" convention `vendorsApi.get`/`update` already use for
 * `/api/company-vendors/{id}`, not `companyVendorId` (a different id, also present on the row).
 */
export const productVendorsApi = {
  list: (productId: string) => api.get<ProductVendor[]>(`/api/products/${productId}/vendors`).then((r) => r.data),

  /**
   * Partial patch — used for both editing packaging defaults and the preferred-vendor swap
   * (`{ isPreferred: true }` alone triggers the atomic server-side swap; there is no way to send
   * `isPreferred: false` from this UI by design, see the Vendors tab).
   */
  update: (productId: string, vendorId: string, payload: ProductVendorUpdatePayload) =>
    api.patch<ProductVendor>(`/api/products/${productId}/vendors/${vendorId}`, payload).then((r) => r.data),

  addPriceTier: (productId: string, vendorId: string, payload: PriceTierPayload) =>
    api
      .post<ProductVendorPriceTier>(`/api/products/${productId}/vendors/${vendorId}/price-tiers`, payload)
      .then((r) => r.data),

  deletePriceTier: (productId: string, vendorId: string, tierId: string) =>
    api.delete<void>(`/api/products/${productId}/vendors/${vendorId}/price-tiers/${tierId}`).then((r) => r.data),
}
