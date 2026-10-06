import { superAdminApi } from '@/api/superAdminClient'

export type MessageKind = 'WELCOME' | 'LOADED' | 'DAY_3' | 'DAY_7'

export interface ShopActivity {
  products: number
  firstProductAt?: string
  /** The shop's own stock changes: not import opening stock, not Procurepaddy support's. */
  stockChanges: number
  firstStockChangeAt?: string
  counts: number
  changesLast7Days: number
  activeDaysFirstWeek: number
  lowStock: number
  staff: number
  listFiles: number
}

export interface FirstWeekShop {
  clientId: string
  name: string
  companyId: string
  /** +234 form; absent when the shop gave no mobile number. */
  whatsapp?: string
  createdAt: string
  setupRequestId?: string
  setupStatus?: string
  founding: boolean
  activity: ShopActivity
  /** Products loaded and its own first stock change within 72 hours of signing up. */
  activated: boolean
  /** Own stock changes on 5 of its first 7 days. */
  habit: boolean
  /** Kind → when it was sent. */
  messages: Partial<Record<MessageKind, string>>
  supportAccess?: 'ON' | 'OFF'
}

export interface FirstWeekReport {
  days: number
  page: number
  totalPages: number
  setupRequests: number
  signups: number
  productsLoaded: number
  activated: number
  habitEligible: number
  habit: number
  shops: FirstWeekShop[]
}

export const firstWeekApi = {
  /** The funnel covers the whole window; `shops` is one page of it, newest first. */
  report: (params: { days: number; page: number; search?: string }) =>
    superAdminApi
      .get<FirstWeekReport>('/api/superadmin/first-week', { params: { ...params, size: 25, search: params.search || undefined } })
      .then((r) => r.data),
  markSent: (clientId: string, kind: MessageKind) =>
    superAdminApi.post<void>(`/api/superadmin/first-week/${clientId}/messages/${kind}`),
  unmark: (clientId: string, kind: MessageKind) =>
    superAdminApi.delete<void>(`/api/superadmin/first-week/${clientId}/messages/${kind}`),
}
