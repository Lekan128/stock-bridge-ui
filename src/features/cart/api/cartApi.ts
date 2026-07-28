import { api } from '@/api/client'
import type { AddCartItemPayload, Cart, MergeCartPayload } from '@/features/cart/types'

/**
 * Server cart endpoints (contract §7). Authenticated only — the anonymous cart lives in
 * localStorage and never touches these (contract §8).
 *
 * Every mutation is typed as returning the whole `Cart` so the caller can apply one authoritative
 * server state instead of patching its local copy and drifting. CartContext still falls back to a
 * refetch if a response comes back without an `items` array, so a backend that returns 204 here
 * degrades to an extra round trip rather than to a blank cart.
 */
export const cartApi = {
  get: () => api.get<Cart>('/api/cart').then((r) => r.data),

  addItem: (payload: AddCartItemPayload) => api.post<Cart>('/api/cart/items', payload).then((r) => r.data),

  updateItem: (productId: string, quantity: number) =>
    api.put<Cart>(`/api/cart/items/${productId}`, { quantity }).then((r) => r.data),

  removeItem: (productId: string) => api.delete<Cart>(`/api/cart/items/${productId}`).then((r) => r.data),

  clear: () => api.delete<void>('/api/cart').then((r) => r.data),

  merge: (payload: MergeCartPayload) => api.post<Cart>('/api/cart/merge', payload).then((r) => r.data),
}
