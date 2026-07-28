// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/orders/pages/OrderListPage — edit that file, not this one.
import { OrderListPage as OrderListPageImpl } from '@/features/orders/pages/OrderListPage'

export function OrderListPage() {
  return <OrderListPageImpl />
}
