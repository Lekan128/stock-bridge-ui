import { api } from '@/api/client'
import type { Branch, BranchList } from '@/features/branches/types'

export interface BranchPayload {
  name?: string
  phone?: string
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
