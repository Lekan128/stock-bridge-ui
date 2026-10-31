import { api } from '@/api/client'
import type { Area, Branch, BranchList } from '@/features/branches/types'

export interface BranchPayload {
  name?: string
  phone?: string
  address?: string
}

/** A company's branches. Changing one is a shared-record edit: online only (Pattern C.5). */
export const branchesApi = {
  list: () => api.get<BranchList>('/api/branches').then((r) => r.data),
  add: (payload: BranchPayload) => api.post<Branch>('/api/branches', payload).then((r) => r.data),
  update: (id: string, payload: BranchPayload) => api.patch<Branch>(`/api/branches/${id}`, payload).then((r) => r.data),
  makeMain: (id: string) => api.post<Branch>(`/api/branches/${id}/main`).then((r) => r.data),
  close: (id: string) => api.post<Branch>(`/api/branches/${id}/close`).then((r) => r.data),
  reopen: (id: string) => api.post<Branch>(`/api/branches/${id}/reopen`).then((r) => r.data),
  /** One low-stock level for many products at a branch; null takes them back to their own (Phase 4). */
  setThresholds: (id: string, body: { productIds: string[]; lowStockThreshold: number | null }) =>
    api.put<{ updated: number }>(`/api/branches/${id}/thresholds`, body).then((r) => r.data),
}

/** A new area: `keepsStock` false for one that uses what it's given; `shortIsUsed` where stock is worked with. */
export interface NewArea {
  name: string
  keepsStock: boolean
  shortIsUsed?: boolean
}

/** A branch's areas (STOCK_AREAS_PART_1.md). Shared records, so online only, like branches. */
export const areasApi = {
  add: (branchId: string, areas: NewArea[]) =>
    api.post<Area[]>(`/api/branches/${branchId}/areas`, { areas }).then((r) => r.data),
  update: (
    id: string,
    payload: { name?: string; keepsStock?: boolean; delivery?: boolean; shortIsUsed?: boolean; confirms?: boolean },
  ) =>
    api.patch<Area>(`/api/areas/${id}`, payload).then((r) => r.data),
  close: (id: string) => api.post<Area>(`/api/areas/${id}/close`).then((r) => r.data),
  reopen: (id: string) => api.post<Area>(`/api/areas/${id}/reopen`).then((r) => r.data),
}
