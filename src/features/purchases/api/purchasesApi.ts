import { api } from '@/api/client'
import type { PageResponse } from '@/features/products/types'
import type { PurchaseHistoryEntry, PurchaseHistoryParams } from '@/features/purchases/types'

/**
 * `/api/purchases` — one endpoint for both screens. `companyVendorId` set is the per-vendor
 * purchase-history screen; omitted, it is the company-wide feed above it. Both merge marketplace
 * orders and manual stock-ins into one date-ordered page server-side (see the API's
 * PurchaseHistoryRepository for why that has to happen in the database rather than here).
 */
export const purchasesApi = {
  search: (params: PurchaseHistoryParams) =>
    api.get<PageResponse<PurchaseHistoryEntry>>('/api/purchases', { params }).then((r) => r.data),
}
