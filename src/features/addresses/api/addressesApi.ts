import { api } from '@/api/client'
import type { DeliveryAddress, DeliveryAddressPayload } from '@/features/addresses/types'

export const addressesApi = {
  /** Returns active addresses only — a plain array, not a page. */
  list: () => api.get<DeliveryAddress[]>('/api/delivery-addresses').then((r) => r.data),

  create: (payload: DeliveryAddressPayload) =>
    api.post<DeliveryAddress>('/api/delivery-addresses', payload).then((r) => r.data),

  update: (id: string, payload: DeliveryAddressPayload) =>
    api.put<DeliveryAddress>(`/api/delivery-addresses/${id}`, payload).then((r) => r.data),

  /** A deactivation server-side, which is indistinguishable from a delete for every caller. */
  remove: (id: string) => api.delete<void>(`/api/delivery-addresses/${id}`).then((r) => r.data),

  /** The swap is transactional server-side: exactly one address is default at any moment. */
  makeDefault: (id: string) =>
    api.post<DeliveryAddress>(`/api/delivery-addresses/${id}/default`).then((r) => r.data),
}
