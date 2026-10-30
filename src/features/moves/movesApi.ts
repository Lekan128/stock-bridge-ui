import { api } from '@/api/client'
import type { AreaMove, AreaMovePayload } from '@/features/moves/types'
import type { PageResponse } from '@/features/products/types'

/** Moves between the areas of a branch (STOCK_AREAS_PART_2.md). Writes go through the outbox. */
export const movesApi = {
  move: (payload: AreaMovePayload) => api.post<AreaMove>('/api/area-moves', payload).then((r) => r.data),
  undo: (id: string) => api.post<AreaMove>(`/api/area-moves/${id}/undo`).then((r) => r.data),
  get: (id: string) => api.get<AreaMove>(`/api/area-moves/${id}`).then((r) => r.data),
  list: (params: { branchId?: string; productId?: string; page?: number; size?: number }) =>
    api.get<PageResponse<AreaMove>>('/api/area-moves', { params }).then((r) => r.data),
}
