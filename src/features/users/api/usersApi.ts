import { api } from '@/api/client'
import type {
  CreateUserPayload,
  PageResponse,
  ResetPasswordPayload,
  TenantUserSummary,
  UpdateUserPayload,
} from '@/features/users/types'

export interface UserListParams {
  page?: number
  size?: number
}

export const usersApi = {
  list: (params: UserListParams) =>
    api.get<PageResponse<TenantUserSummary>>('/api/users', { params }).then((r) => r.data),

  get: (id: string) => api.get<TenantUserSummary>(`/api/users/${id}`).then((r) => r.data),

  create: (payload: CreateUserPayload) => api.post<TenantUserSummary>('/api/users', payload).then((r) => r.data),

  update: (id: string, payload: UpdateUserPayload) =>
    api.put<TenantUserSummary>(`/api/users/${id}`, payload).then((r) => r.data),

  resetPassword: (id: string, payload: ResetPasswordPayload) =>
    api.post<void>(`/api/users/${id}/reset-password`, payload).then((r) => r.data),

  deactivate: (id: string) => api.delete<void>(`/api/users/${id}`).then((r) => r.data),
}
