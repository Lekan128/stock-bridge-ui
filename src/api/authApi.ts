import { api } from '@/api/client'
import type {
  AuthTokens,
  ClientSignupRequest,
  PasswordResetAccount,
  TenantLoginRequest,
  TenantLoginResponse,
} from '@/types/auth'

export const authApi = {
  tenantLogin: (payload: TenantLoginRequest) =>
    api.post<TenantLoginResponse>('/api/auth/login', payload, { public: true }).then((r) => r.data),

  tenantRefresh: (refreshToken: string) =>
    api.post<AuthTokens>('/api/auth/refresh', { refreshToken }, { public: true }).then((r) => r.data),

  tenantLogout: (refreshToken: string) => api.post<void>('/api/auth/logout', { refreshToken }),

  signup: (payload: ClientSignupRequest) =>
    api.post<TenantLoginResponse>('/api/clients/signup', payload, { public: true }).then((r) => r.data),

  /**
   * Self-service password reset (PASSWORD_RESET_PLAN.md). All three are `public`: the caller has
   * no working password, and a bad link must answer 400 without dragging a signed-in user on this
   * device through the 401-refresh cycle.
   *
   * `requestPasswordReset` answers 202 whether or not the email has an account, by design.
   */
  requestPasswordReset: (email: string) =>
    api.post<void>('/api/auth/password-reset/request', { email }, { public: true }),

  /** Which account a reset link is for. Does not use the link up. */
  checkPasswordReset: (token: string) =>
    api
      .post<PasswordResetAccount>('/api/auth/password-reset/check', { token }, { public: true })
      .then((r) => r.data),

  /** Uses the link: sets the password and returns a session, like a login. */
  completePasswordReset: (token: string, newPassword: string) =>
    api
      .post<TenantLoginResponse>('/api/auth/password-reset/complete', { token, newPassword }, { public: true })
      .then((r) => r.data),
}
