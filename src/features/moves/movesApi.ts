import { api } from '@/api/client'
import type { AreaMove, AreaMoveConfirmPayload, AreaMovePayload, AreaReturnPayload } from '@/features/moves/types'
import type { PageResponse } from '@/features/products/types'

/** Moves between the areas of a branch (STOCK_AREAS_PART_2.md). Writes go through the outbox. */
export const movesApi = {
  move: (payload: AreaMovePayload) => api.post<AreaMove>('/api/area-moves', payload).then((r) => r.data),
  undo: (id: string) => api.post<AreaMove>(`/api/area-moves/${id}/undo`).then((r) => r.data),
  /** What arrived of a move waiting for an area that confirms (Part 4). Through the outbox. */
  confirm: (id: string, payload: AreaMoveConfirmPayload) =>
    api.post<AreaMove>(`/api/area-moves/${id}/confirm`, payload).then((r) => r.data),
  /** Takes back a move still waiting (Part 4). Online only. */
  cancel: (id: string) => api.post<AreaMove>(`/api/area-moves/${id}/cancel`).then((r) => r.data),
  /** Gives back, or reports, part of what an area received (Part 6). Through the outbox. */
  giveBackOrReport: (id: string, payload: AreaReturnPayload) =>
    api.post<AreaMove>(`/api/area-moves/${id}/returns`, payload).then((r) => r.data),
  /** What arrived lately in the areas this person works in, to give back or report (Part 6). */
  received: (branchId?: string) =>
    api.get<AreaMove[]>('/api/area-moves/received', { params: branchId ? { branchId } : {} }).then((r) => r.data),
  /** The moves waiting for this person to confirm, at one branch or every one they see. */
  waiting: (branchId?: string) =>
    api.get<AreaMove[]>('/api/area-moves/waiting', { params: branchId ? { branchId } : {} }).then((r) => r.data),
  get: (id: string) => api.get<AreaMove>(`/api/area-moves/${id}`).then((r) => r.data),
  list: (params: { branchId?: string; productId?: string; page?: number; size?: number }) =>
    api.get<PageResponse<AreaMove>>('/api/area-moves', { params }).then((r) => r.data),
}
