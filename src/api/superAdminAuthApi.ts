import { superAdminApi } from '@/api/superAdminClient'
import type { AuthTokens, SuperAdminLoginRequest, SuperAdminLoginResponse } from '@/types/auth'

export const superAdminAuthApi = {
  login: (payload: SuperAdminLoginRequest) =>
    superAdminApi.post<SuperAdminLoginResponse>('/api/superadmin/auth/login', payload, { public: true }).then((r) => r.data),

  refresh: (refreshToken: string) =>
    superAdminApi.post<AuthTokens>('/api/superadmin/auth/refresh', { refreshToken }, { public: true }).then((r) => r.data),

  logout: (refreshToken: string) => superAdminApi.post<void>('/api/superadmin/auth/logout', { refreshToken }),
}
