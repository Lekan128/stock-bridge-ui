import { useContext } from 'react'
import { CartContext, type CartContextValue } from '@/features/cart/context/CartContext'

/**
 * The only sanctioned way to read or change the cart. Exactly one context owns cart state
 * (contract §8) — nothing else reads localStorage or calls `/api/cart` directly, or the header
 * badge and the cart page will disagree.
 */
export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return ctx
}
