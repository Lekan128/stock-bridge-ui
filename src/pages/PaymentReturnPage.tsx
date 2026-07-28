// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/checkout/pages/PaymentReturnPage — edit that file, not this one.
import { PaymentReturnPage as PaymentReturnPageImpl } from '@/features/checkout/pages/PaymentReturnPage'

export function PaymentReturnPage() {
  return <PaymentReturnPageImpl />
}
