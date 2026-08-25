import { api } from '@/api/client'
import type {
  BulkUploadResponse,
  PageResponse,
  Product,
  ProductFormPayload,
  ProductListParams,
  ProductUpdatePayload,
  UnitOfMeasureOption,
  UnitOfMeasureRequestPayload,
} from '@/features/products/types'

function buildProductFormData(payload: object, image?: File | null): FormData {
  const formData = new FormData()
  formData.append('product', new Blob([JSON.stringify(payload)], { type: 'application/json' }))
  if (image) {
    formData.append('image', image)
  }
  return formData
}

export const productsApi = {
  list: (params: ProductListParams) =>
    api.get<PageResponse<Product>>('/api/products', { params }).then((r) => r.data),

  get: (id: string) => api.get<Product>(`/api/products/${id}`).then((r) => r.data),

  lowStock: () => api.get<Product[]>('/api/products/low-stock').then((r) => r.data),

  create: (payload: ProductFormPayload, image?: File | null) =>
    api
      .post<Product>('/api/products', buildProductFormData(payload, image), {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data),

  update: (id: string, payload: ProductUpdatePayload, image?: File | null) =>
    api
      .put<Product>(`/api/products/${id}`, buildProductFormData(payload, image), {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data),

  deactivate: (id: string) => api.delete<void>(`/api/products/${id}`).then((r) => r.data),

  template: () => api.get('/api/products/template', { responseType: 'blob' }).then((r) => r.data as Blob),

  export: () => api.get('/api/products/export', { responseType: 'blob' }).then((r) => r.data as Blob),

  bulkUpload: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api
      .post<BulkUploadResponse>('/api/products/bulk-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },

  /**
   * The fixed unit-of-measure list — the source of truth behind the product form's picker.
   * Never hardcode a copy of this: a code the form sends has to be one the server will still
   * accept, and the only way to guarantee that is to ask it.
   */
  unitsOfMeasure: () =>
    api.get<UnitOfMeasureOption[]>('/api/products/units-of-measure').then((r) => r.data),

  /**
   * The "can't find your unit? tell us" affordance. Returns 202 with no body — there is nothing
   * to read back, only a confirmation to show.
   */
  requestUnitOfMeasure: (payload: UnitOfMeasureRequestPayload) =>
    api.post<void>('/api/products/unit-of-measure-requests', payload).then(() => undefined),
}
