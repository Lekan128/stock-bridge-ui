// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/checkout/pages/CheckoutPage — edit that file, not this one.
import { CheckoutPage as CheckoutPageImpl } from '@/features/checkout/pages/CheckoutPage'

export function CheckoutPage() {
  return <CheckoutPageImpl />
}
