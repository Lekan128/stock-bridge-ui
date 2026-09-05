import { api } from '@/api/client'
import type {
  AddPackPayload,
  PriceTierPayload,
  ProductVendor,
  ProductVendorPack,
  ProductVendorPriceTier,
  ProductVendorUpdatePayload,
  UpdatePackPayload,
} from '@/features/products/vendors/types'

/**
 * `/api/products/{productId}/vendors` — the per-product vendor lines (`ProductVendor`), NOT the
 * company's vendor directory (`vendorsApi`, `/api/company-vendors`). See
 * `features/products/vendors/types.ts` for how the two relate.
 *
 * `{vendorId}` in every path below is the `ProductVendor` row's own `id` — the same "address a
 * resource by its own primary key" convention `vendorsApi.get`/`update` already use for
 * `/api/company-vendors/{id}`, not `companyVendorId` (a different id, also present on the row).
 * `{packId}` on the pack/price-tier routes is likewise a `ProductVendorPack` row's own id
 * (MULTI_PACK_PER_VENDOR_DESIGN.md sections 4-7) — price tiers moved one level deeper than the
 * vendor line itself, since a tier is a property of a specific priced offering.
 */
export const productVendorsApi = {
  list: (productId: string) => api.get<ProductVendor[]>(`/api/products/${productId}/vendors`).then((r) => r.data),

  /**
   * Partial patch — used for both editing the default pack's fields and the preferred-vendor swap
   * (`{ isPreferred: true }` alone triggers the atomic server-side swap; there is no way to send
   * `isPreferred: false` from this UI by design, see the Vendors tab). `addPack`/`updatePack`
   * below are the direct way to manage a non-default pack, which this endpoint can't address.
   */
  update: (productId: string, vendorId: string, payload: ProductVendorUpdatePayload) =>
    api.patch<ProductVendor>(`/api/products/${productId}/vendors/${vendorId}`, payload).then((r) => r.data),

  addPack: (productId: string, vendorId: string, payload: AddPackPayload) =>
    api.post<ProductVendorPack>(`/api/products/${productId}/vendors/${vendorId}/packs`, payload).then((r) => r.data),

  updatePack: (productId: string, vendorId: string, packId: string, payload: UpdatePackPayload) =>
    api
      .patch<ProductVendorPack>(`/api/products/${productId}/vendors/${vendorId}/packs/${packId}`, payload)
      .then((r) => r.data),

  deletePack: (productId: string, vendorId: string, packId: string) =>
    api.delete<void>(`/api/products/${productId}/vendors/${vendorId}/packs/${packId}`).then((r) => r.data),

  addPriceTier: (productId: string, vendorId: string, packId: string, payload: PriceTierPayload) =>
    api
      .post<ProductVendorPriceTier>(
        `/api/products/${productId}/vendors/${vendorId}/packs/${packId}/price-tiers`,
        payload,
      )
      .then((r) => r.data),

  deletePriceTier: (productId: string, vendorId: string, packId: string, tierId: string) =>
    api
      .delete<void>(`/api/products/${productId}/vendors/${vendorId}/packs/${packId}/price-tiers/${tierId}`)
      .then((r) => r.data),
}
