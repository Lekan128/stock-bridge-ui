import { api } from '@/api/client'
import type { CompanyCategory, CompanyCategoryPayload } from '@/features/products/categories/types'

const BASE = '/api/company-categories'

/**
 * A company's own product categories. Reading needs VIEW_PRODUCTS; every write needs
 * MANAGE_PRODUCTS. Duplicate names (case-insensitive) come back as 409 and blank or over-long
 * names as 400, both with a `message` meant for the user — callers show it as-is.
 */
export const companyCategoriesApi = {
  /** Every category, already sorted by name, with its product count. Not paged — see the hook. */
  list: () => api.get<CompanyCategory[]>(BASE).then((r) => r.data),

  create: (payload: CompanyCategoryPayload) => api.post<CompanyCategory>(BASE, payload).then((r) => r.data),

  rename: (id: string, payload: CompanyCategoryPayload) =>
    api.put<CompanyCategory>(`${BASE}/${id}`, payload).then((r) => r.data),

  /** The category's products are kept and become uncategorised; nothing else is deleted. */
  remove: (id: string) => api.delete<void>(`${BASE}/${id}`).then(() => undefined),
}
