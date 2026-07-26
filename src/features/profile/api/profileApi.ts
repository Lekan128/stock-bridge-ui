import { api } from '@/api/client'
import type { ChangePasswordPayload, Profile, UpdateProfilePayload } from '@/features/profile/types'

export const profileApi = {
  get: () => api.get<Profile>('/api/me').then((r) => r.data),

  /** REPLACE semantics — the payload must always carry all five fields. */
  update: (payload: UpdateProfilePayload) => api.put<Profile>('/api/me', payload).then((r) => r.data),

  changePassword: (payload: ChangePasswordPayload) => api.post<void>('/api/me/password', payload).then((r) => r.data),
}
