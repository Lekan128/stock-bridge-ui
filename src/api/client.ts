import { createApiClient } from '@/api/createApiClient'
import { authStorage } from '@/utils/storage'

export const { api, setAccessToken, getAccessToken, setAuthFailureHandler, refreshSession } = createApiClient({
  refreshPath: '/api/auth/refresh',
  loginRedirectPath: '/login',
  getRefreshToken: authStorage.getRefreshToken,
  setRefreshToken: authStorage.setRefreshToken,
  clearSession: authStorage.clearSession,
})
