import { api } from '@/api/client'
import type { Role } from '@/features/users/types'

export const rolesApi = {
  list: () => api.get<Role[]>('/api/roles').then((r) => r.data),
}
