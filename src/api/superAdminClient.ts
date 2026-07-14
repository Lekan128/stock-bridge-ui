import { createApiClient } from '@/api/createApiClient'
import { superAdminAuthStorage } from '@/utils/storage'

// Fully independent from src/api/client.ts (tenant): its own axios instance, its own in-memory
// access token, its own refresh cycle against the super-admin auth endpoints, and its own
// storage key (see utils/storage.ts) — so a tenant session and a super-admin session can be
// live in the same browser at once without either interfering with the other.
export const {
  api: superAdminApi,
  setAccessToken: setSuperAdminAccessToken,
  getAccessToken: getSuperAdminAccessToken,
  setAuthFailureHandler: setSuperAdminAuthFailureHandler,
} = createApiClient({
  refreshPath: '/api/superadmin/auth/refresh',
  loginRedirectPath: '/admin/login',
  getRefreshToken: superAdminAuthStorage.getRefreshToken,
  setRefreshToken: superAdminAuthStorage.setRefreshToken,
  clearSession: superAdminAuthStorage.clearSession,
})
