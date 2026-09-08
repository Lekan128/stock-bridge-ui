import { api } from '@/api/client'
import type { CreateRolePayload, PermissionCatalogEntry, UpdateRolePayload } from '@/features/roles/types'
import type { Role } from '@/features/users/types'

export const rolesManagementApi = {
  create: (payload: CreateRolePayload) => api.post<Role>('/api/roles', payload).then((r) => r.data),

  update: (id: string, payload: UpdateRolePayload) => api.put<Role>(`/api/roles/${id}`, payload).then((r) => r.data),

  delete: (id: string) => api.delete<void>(`/api/roles/${id}`).then((r) => r.data),
}

export const permissionsApi = {
  list: () => api.get<PermissionCatalogEntry[]>('/api/permissions').then((r) => r.data),
}
