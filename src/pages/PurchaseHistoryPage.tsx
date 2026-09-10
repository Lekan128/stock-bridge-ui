// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/purchases/pages/PurchaseHistoryPage — edit that file, not this one.
import { PurchaseHistoryPage as PurchaseHistoryPageImpl } from '@/features/purchases/pages/PurchaseHistoryPage'

export function PurchaseHistoryPage() {
  return <PurchaseHistoryPageImpl />
}
