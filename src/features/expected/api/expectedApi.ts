import { api } from '@/api/client'
import { viewingBranchId } from '@/features/branches/viewingBranch'
import { recordingBranchId } from '@/features/outbox/outboxStore'
import type {
  ExpectedDelivery,
  ExpectedDeliveryInput,
  ExpectedDeliveryListParams,
  PageResponse,
  PickerLine,
  PurchaseOrderCounts,
  RecentSupplier,
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
        // At a branch, the ones going there; in "All branches", every one (each with its branch).
        params: {
          status: params.status,
          view: params.view,
          search: params.search?.trim() || undefined,
          vendorId: params.vendorId,
          page: params.page,
          size: params.size,
          branchId: viewingBranchId(),
        },
      })
      .then((response) => response.data)
  },

  /** GET /api/expected-deliveries/counts — how many each filter chip holds, with the same search. */
  counts(search?: string): Promise<PurchaseOrderCounts> {
    return api
      .get<PurchaseOrderCounts>(`${BASE}/counts`, { params: { search: search?.trim() || undefined, branchId: viewingBranchId() } })
      .then((response) => response.data)
  },

  /**
   * GET /api/expected-deliveries/picker — products for a new order, each line with stock left at
   * `branchId`, low or out, what is coming, and last time's quantity from this supplier.
   */
  picker(params: {
    search?: string
    vendorId?: string
    runningLow?: boolean
    branchId?: string
    limit?: number
    productIds?: string[]
    /** Changing an order: its own lines aren't counted as "coming". */
    excludeOrderId?: string
  }): Promise<PickerLine[]> {
    return api
      .get<PickerLine[]>(`${BASE}/picker`, {
        params: {
          search: params.search?.trim() || undefined,
          vendorId: params.vendorId || undefined,
          runningLow: params.runningLow || undefined,
          branchId: params.branchId || recordingBranchId() || undefined,
          limit: params.limit,
          productIds: params.productIds && params.productIds.length > 0 ? params.productIds.join(',') : undefined,
          excludeOrderId: params.excludeOrderId || undefined,
        },
      })
      .then((response) => response.data)
  },

  /** GET /api/expected-deliveries/recent-suppliers — newest first. */
  recentSuppliers(): Promise<RecentSupplier[]> {
    return api.get<RecentSupplier[]>(`${BASE}/recent-suppliers`).then((response) => response.data)
  },

  /** PUT /api/expected-deliveries/{id} — change a purchase order (the next revision once the supplier has it). */
  change(id: string, body: Pick<ExpectedDeliveryInput, 'expectedDate' | 'note' | 'lines' | 'deliveryCharge' | 'approvalNote'>): Promise<ExpectedDelivery> {
    return api.put<ExpectedDelivery>(`${BASE}/${id}`, body).then((response) => response.data)
  },

  /** POST /api/expected-deliveries/{id}/approve — "Approve and send" (V78). */
  approve(id: string): Promise<ExpectedDelivery> {
    return api.post<ExpectedDelivery>(`${BASE}/${id}/approve`).then((response) => response.data)
  },

  /** POST /api/expected-deliveries/{id}/ask-change — back to whoever made it, with what to change. */
  askChange(id: string, note: string): Promise<ExpectedDelivery> {
    return api.post<ExpectedDelivery>(`${BASE}/${id}/ask-change`, { note }).then((response) => response.data)
  },

  /** GET /api/expected-deliveries/{id} */
  get(id: string): Promise<ExpectedDelivery> {
    return api.get<ExpectedDelivery>(`${BASE}/${id}`).then((response) => response.data)
  },

  /** POST /api/expected-deliveries — 201 with the record it created. */
  create(body: ExpectedDeliveryInput): Promise<ExpectedDelivery> {
    // Going to the phone's branch (V52); the server uses the person's one branch otherwise.
    return api.post<ExpectedDelivery>(BASE, { branchId: recordingBranchId(), ...body }).then((response) => response.data)
  },

  /**
   * POST /api/expected-deliveries/{id}/email — emails a purchase order to its supplier, and is also
   * the resend. Answers 200 with the order whatever happened: the outcome is `email` on it, in a
   * sentence the screen can show as it is.
   */
  email(id: string): Promise<ExpectedDelivery> {
    return api.post<ExpectedDelivery>(`${BASE}/${id}/email`).then((response) => response.data)
  },

  /**
   * POST /api/expected-deliveries/{id}/shared?channel= — "the buyer opened WhatsApp" or "copied the
   * message", written on the order so the line still reads true next week.
   */
  shared(id: string, channel: 'WHATSAPP' | 'MESSAGE'): Promise<ExpectedDelivery> {
    return api
      .post<ExpectedDelivery>(`${BASE}/${id}/shared`, null, { params: { channel } })
      .then((response) => response.data)
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
