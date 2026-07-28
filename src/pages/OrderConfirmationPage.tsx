// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/checkout/pages/OrderConfirmationPage — edit that file, not this one.
import { OrderConfirmationPage as OrderConfirmationPageImpl } from '@/features/checkout/pages/OrderConfirmationPage'

export function OrderConfirmationPage() {
  return <OrderConfirmationPageImpl />
}
