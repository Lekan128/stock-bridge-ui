// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/cart/pages/CartPage — edit that file, not this one.
import { CartPage as CartPageImpl } from '@/features/cart/pages/CartPage'

export function CartPage() {
  return <CartPageImpl />
}
