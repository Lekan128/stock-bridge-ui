import { api } from '@/api/client'
import type { Product } from '@/features/products/types'

/**
 * `DAMAGED_CODE` — a code an old spreadsheet reader turned into a number ("28.0").
 * `NO_STOCK_UNIT` — saved before units existed. The other two have no one-click fix: the owner
 * has to look at the product and decide, so the fix screen links to its edit page.
 */
export type ProductDataIssueCode = 'DAMAGED_CODE' | 'NO_STOCK_UNIT' | 'UNIT_LOOKS_WRONG' | 'PACK_LOOKS_TOO_SMALL'

export interface ProductDataIssueDetail {
  code: ProductDataIssueCode
  /** Written for the owner — shown as-is. */
  message: string
  /** Only on `DAMAGED_CODE`, and only when the server can repair it ("28.0" → "28"). */
  suggestedCode?: string | null
}

export interface ProductDataIssue {
  productId: string
  name: string
  sku: string
  quantityOnHand: number
  issues: ProductDataIssueDetail[]
}

/**
 * The one-time "fix product details" prompt. Reading needs VIEW_PRODUCTS; fixing a code needs
 * MANAGE_PRODUCTS. Setting a unit goes through the ordinary `productsApi.update` — the server
 * allows it on a product with no unit even after stock was recorded.
 */
export const productDataIssuesApi = {
  /** Active products with at least one issue; an empty array when everything looks right. */
  list: () => api.get<ProductDataIssue[]>('/api/products/data-issues').then((r) => r.data),

  /**
   * A blank or omitted `code` lets the server use its suggestion, or generate a new code when
   * the company has code generation on. 409 when the code isn't damaged or is already taken.
   */
  fixCode: (productId: string, code?: string) =>
    api
      .post<Product>(`/api/products/${productId}/fix-code`, code ? { code } : {})
      .then((r) => r.data),
}
