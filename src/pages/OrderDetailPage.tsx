// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/orders/pages/OrderDetailPage — edit that file, not this one.
import { OrderDetailPage as OrderDetailPageImpl } from '@/features/orders/pages/OrderDetailPage'

export function OrderDetailPage() {
  return <OrderDetailPageImpl />
}
