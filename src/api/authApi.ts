import { api } from '@/api/client'
import type { AuthTokens, ClientSignupRequest, TenantLoginRequest, TenantLoginResponse } from '@/types/auth'

export const authApi = {
  tenantLogin: (payload: TenantLoginRequest) =>
    api.post<TenantLoginResponse>('/api/auth/login', payload, { public: true }).then((r) => r.data),

  tenantRefresh: (refreshToken: string) =>
    api.post<AuthTokens>('/api/auth/refresh', { refreshToken }, { public: true }).then((r) => r.data),

  tenantLogout: (refreshToken: string) => api.post<void>('/api/auth/logout', { refreshToken }),

  signup: (payload: ClientSignupRequest) =>
    api.post<TenantLoginResponse>('/api/clients/signup', payload, { public: true }).then((r) => r.data),
}
