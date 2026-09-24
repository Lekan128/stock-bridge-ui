import { api } from '@/api/client'
import type {
  ExpectedDelivery,
  ExpectedDeliveryInput,
  ExpectedDeliveryListParams,
  PageResponse,
} from '@/features/expected/types'

const BASE = '/api/expected-deliveries'

/**
 * The one seam between the expected-delivery screens and the server.
 *
 * No component imports anything from `api/` except this object, the same rule
 * `features/imports/api/importsApi.ts` follows — and, like that one, there is no mock behind it.
 * Develop against the real API.
 *
 * Reading needs VIEW_PRODUCTS; creating and cancelling need MANAGE_INVENTORY, the same authority
 * recording a delivery needs. Receiving is deliberately absent: it goes through
 * `importsApi.createDelivery` with an `expectedDeliveryId`, so there is one stock path and one
 * ledger.
 */
export const expectedApi = {
  /** GET /api/expected-deliveries?status=&page=&size= — newest first. */
  list(params: ExpectedDeliveryListParams): Promise<PageResponse<ExpectedDelivery>> {
    return api
      .get<PageResponse<ExpectedDelivery>>(BASE, {
        params: { status: params.status, page: params.page, size: params.size },
      })
      .then((response) => response.data)
  },

  /** GET /api/expected-deliveries/{id} */
  get(id: string): Promise<ExpectedDelivery> {
    return api.get<ExpectedDelivery>(`${BASE}/${id}`).then((response) => response.data)
  },

  /** POST /api/expected-deliveries — 201 with the record it created. */
  create(body: ExpectedDeliveryInput): Promise<ExpectedDelivery> {
    return api.post<ExpectedDelivery>(BASE, body).then((response) => response.data)
  },

  /**
   * POST /api/expected-deliveries/{id}/cancel — returns the cancelled record.
   *
   * A POST rather than a DELETE because the record stays: what you expected and never got is
   * worth keeping.
   */
  cancel(id: string): Promise<ExpectedDelivery> {
    return api.post<ExpectedDelivery>(`${BASE}/${id}/cancel`).then((response) => response.data)
  },
}
