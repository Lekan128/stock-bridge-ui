import { api } from '@/api/client'
import type { Company, UpdateCompanyPayload } from '@/features/company/types'

export const companyApi = {
  /** No permission required — any authenticated tenant user may read their own company. */
  get: () => api.get<Company>('/api/company').then((r) => r.data),

  /** Requires MANAGE_COMPANY_PROFILE (OWNER only). REPLACE semantics — send all three fields. */
  update: (payload: UpdateCompanyPayload) => api.put<Company>('/api/company', payload).then((r) => r.data),
}
