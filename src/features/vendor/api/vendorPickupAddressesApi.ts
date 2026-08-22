import { api } from '@/api/client'
import type { DeliveryAddress, DeliveryAddressPayload } from '@/features/addresses/types'

/**
 * Where a seller's goods are collected FROM.
 *
 * <h2>Same shape as the buyer address book, different rows</h2>
 * The payload and response types are reused from `@/features/addresses` on purpose: server
 * side these are the same table and the same DTOs, told apart by an `address_purpose`
 * discriminator the API sets from the ROUTE rather than from the body. A parallel set of
 * types here would be a copy that drifts — the first time a field is added to one and not the
 * other, the shared address form stops working on one of the two screens.
 *
 * The rows never overlap: this endpoint only ever serves PICKUP rows and
 * `/api/delivery-addresses` only ever serves DELIVERY ones, so a pickup depot can never be
 * offered as somewhere to deliver TO. That matters most for ProcurePal, which is a seller AND
 * an ordinary buying company — tenant scoping cannot separate its two kinds of address
 * because they belong to the same tenant.
 *
 * The one field whose name reads oddly here is `deliveryNotes`, which a seller uses for
 * collection instructions. It keeps the buyer name because renaming it on the wire would mean
 * a second mapping to keep in step for no behavioural gain.
 */
const BASE = '/api/vendor/pickup-addresses'

export const vendorPickupAddressesApi = {
  /** Active pickup points only — a plain array, not a page. */
  list: () => api.get<DeliveryAddress[]>(BASE).then((r) => r.data),

  create: (payload: DeliveryAddressPayload) => api.post<DeliveryAddress>(BASE, payload).then((r) => r.data),

  update: (id: string, payload: DeliveryAddressPayload) =>
    api.put<DeliveryAddress>(`${BASE}/${id}`, payload).then((r) => r.data),

  /** A deactivation server-side, which is indistinguishable from a delete for every caller. */
  remove: (id: string) => api.delete<void>(`${BASE}/${id}`).then((r) => r.data),

  /** The swap is transactional server-side: exactly one pickup point is default at any moment. */
  makeDefault: (id: string) => api.post<DeliveryAddress>(`${BASE}/${id}/default`).then((r) => r.data),
}
