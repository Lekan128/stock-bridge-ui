import { api } from '@/api/client'
import type {
  AdminCatalogProduct,
  AdminCategory,
  AdminMarketplaceSettings,
  AdminOrder,
  AdminOrderQueueParams,
  AdminOrderSummary,
  AdminProductListParams,
  AdvanceOrderStatusPayload,
  BulkListingResult,
  CreateCategoryPayload,
  PageResponse,
  UpdateCategoryPayload,
  UpdateMarketplaceDetailsPayload,
  UpdateMarketplaceSettingsPayload,
} from '@/features/marketplace/types'

/**
 * ProcurePal's own marketplace administration API. Every route here is behind
 * `RequirePlatformOwner` + a permission on the client, and behind two independent gates on the
 * server (permission + platform-owner guard), so a 403 from any of these means the operator is
 * signed in as the wrong company rather than that something broke.
 *
 * No `public: true` anywhere — unlike the storefront calls, these must go through the shared
 * refresh-and-retry cycle.
 */
const BASE = '/api/marketplace/admin'

export const marketplaceAdminApi = {
  // -- Fulfilment queue -----------------------------------------------------------------------

  orders: (params: AdminOrderQueueParams) =>
    api.get<PageResponse<AdminOrderSummary>>(`${BASE}/orders`, { params }).then((r) => r.data),

  order: (id: string) => api.get<AdminOrder>(`${BASE}/orders/${id}`).then((r) => r.data),

  advanceStatus: (id: string, payload: AdvanceOrderStatusPayload) =>
    api.post<AdminOrder>(`${BASE}/orders/${id}/status`, payload).then((r) => r.data),

  /** COD settle. Idempotent server-side: two staff pressing it cannot double-count the cash. */
  recordPaymentReceived: (id: string) =>
    api.post<AdminOrder>(`${BASE}/orders/${id}/payment-received`).then((r) => r.data),

  // -- Catalog --------------------------------------------------------------------------------

  products: (params: AdminProductListParams) =>
    api.get<PageResponse<AdminCatalogProduct>>(`${BASE}/products`, { params }).then((r) => r.data),

  setListing: (id: string, listed: boolean) =>
    api.post<AdminCatalogProduct>(`${BASE}/products/${id}/listing`, { listed }).then((r) => r.data),

  bulkListing: (productIds: string[], listed: boolean) =>
    api.post<BulkListingResult>(`${BASE}/products/bulk-listing`, { productIds, listed }).then((r) => r.data),

  updateMarketplaceDetails: (id: string, payload: UpdateMarketplaceDetailsPayload) =>
    api.put<AdminCatalogProduct>(`${BASE}/products/${id}/marketplace-details`, payload).then((r) => r.data),

  // -- Categories -----------------------------------------------------------------------------

  categories: () => api.get<AdminCategory[]>(`${BASE}/categories`).then((r) => r.data),

  createCategory: (payload: CreateCategoryPayload) =>
    api.post<AdminCategory>(`${BASE}/categories`, payload).then((r) => r.data),

  updateCategory: (id: string, payload: UpdateCategoryPayload) =>
    api.put<AdminCategory>(`${BASE}/categories/${id}`, payload).then((r) => r.data),

  /** 409 when products still reference the category; the server's message names the alternative. */
  deleteCategory: (id: string) => api.delete<void>(`${BASE}/categories/${id}`).then((r) => r.data),

  // -- Commercial settings --------------------------------------------------------------------

  settings: () => api.get<AdminMarketplaceSettings>(`${BASE}/settings`).then((r) => r.data),

  /** Full replacement, not a patch — send every field or the omitted ones fail validation. */
  updateSettings: (payload: UpdateMarketplaceSettingsPayload) =>
    api.put<AdminMarketplaceSettings>(`${BASE}/settings`, payload).then((r) => r.data),
}
