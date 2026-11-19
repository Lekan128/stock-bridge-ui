import { api } from '@/api/client'
import type { PageResponse } from '@/features/products/types'
import type { LegacyPriceRow, SellingSettings, UpdateSellingSettingsPayload } from '@/features/selling/types'

/** The company's selling switch and the old-price review (`SELLING_PRICE_PLAN.md` §4.2, §4.6.3). */
export const sellingApi = {
  get: () => api.get<SellingSettings>('/api/company/selling').then((r) => r.data),

  update: (payload: UpdateSellingSettingsPayload) =>
    api.put<SellingSettings>('/api/company/selling', payload).then((r) => r.data),

  /** "Sell things you make" (selling till Step 4): needs selling on to turn on. */
  updateMadeHere: (on: boolean) => api.put<SellingSettings>('/api/company/selling/made-here', { on }).then((r) => r.data),
  updateCountsCash: (on: boolean) => api.put<SellingSettings>('/api/company/selling/counts-cash', { on }).then((r) => r.data),
  updateCashReopenHours: (hours: number) =>
    api.put<SellingSettings>('/api/company/selling/cash-reopen-hours', { hours }).then((r) => r.data),

  legacyPrices: (page: number, size = 50) =>
    api
      .get<PageResponse<LegacyPriceRow>>('/api/company/selling/legacy-prices', { params: { page, size } })
      .then((r) => r.data),

  adoptLegacyPrices: (body: { productIds?: string[]; all?: boolean }) =>
    api.post<SellingSettings>('/api/company/selling/legacy-prices/adopt', body).then((r) => r.data),

  dismissLegacyPrices: () => api.post<SellingSettings>('/api/company/selling/legacy-prices/dismiss').then((r) => r.data),
}
