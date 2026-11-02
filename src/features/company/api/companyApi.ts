import { api } from '@/api/client'
import type { Company, UpdateCompanyPayload } from '@/features/company/types'

export const companyApi = {
  /** No permission required — any authenticated tenant user may read their own company. */
  get: () => api.get<Company>('/api/company').then((r) => r.data),

  /** Requires MANAGE_COMPANY_PROFILE (OWNER only). REPLACE semantics — send all three fields. */
  /** Requires MANAGE_COMPANY_PROFILE. A multipart upload with one part, `file` (JPG/PNG/WebP, 5 MB). */
  setLogo: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api
      .put<Company>('/api/company/logo', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data)
  },

  /** Takes the logo off. The stored file stays, so an order already sent keeps showing it. */
  removeLogo: () => api.delete<Company>('/api/company/logo').then((r) => r.data),

  update: (payload: UpdateCompanyPayload) => api.put<Company>('/api/company', payload).then((r) => r.data),
}
