import { api } from '@/api/client'
import type { PageResponse } from '@/features/products/types'
import type {
  CompanyVendor,
  CompanyVendorDetail,
  CompanyVendorPayload,
  VendorListParams,
  VendorPurchase,
} from '@/features/vendors/types'

/**
 * `/api/company-vendors`, not `/api/vendors`. The word "vendor" means two different things in this
 * product — a seller with a marketplace account, and a row in one buyer's private supplier list —
 * and the path is what keeps them apart.
 */
export const vendorsApi = {
  /** Both kinds in one page unless `kind` narrows it; `search` matches the vendor's name. */
  list: (params: VendorListParams) =>
    api.get<PageResponse<CompanyVendor>>('/api/company-vendors', { params }).then((r) => r.data),

  /** The detail screen's single round trip: the row, the live seller, spend, and products supplied. */
  get: (id: string) => api.get<CompanyVendorDetail>(`/api/company-vendors/${id}`).then((r) => r.data),

  /**
   * Purchase history — its own endpoint because it is its own screen and it is paginated.
   * Always an empty page for an EXTERNAL vendor, by definition rather than by accident.
   */
  purchases: (id: string, page: number, size = 20) =>
    api
      .get<PageResponse<VendorPurchase>>(`/api/company-vendors/${id}/purchases`, { params: { page, size } })
      .then((r) => r.data),

  /** Creates an EXTERNAL supplier. There is no endpoint for creating a VERIFIED one, by design. */
  create: (payload: CompanyVendorPayload) =>
    api.post<CompanyVendor>('/api/company-vendors', payload).then((r) => r.data),

  /** EXTERNAL only — the server answers 409 for a VERIFIED row, which the UI never asks for. */
  update: (id: string, payload: CompanyVendorPayload) =>
    api.put<CompanyVendor>(`/api/company-vendors/${id}`, payload).then((r) => r.data),

  /**
   * A deactivation server-side, which is indistinguishable from a delete for every caller.
   * Allowed for BOTH kinds, unlike edit: removing a supplier from your own list is your opinion
   * about your list, where renaming a VERIFIED one is a claim about somebody else's account.
   */
  remove: (id: string) => api.delete<void>(`/api/company-vendors/${id}`).then((r) => r.data),
}
