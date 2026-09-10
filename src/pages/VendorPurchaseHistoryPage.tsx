// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/vendors/pages/VendorPurchaseHistoryPage — edit that file, not this one.
import { VendorPurchaseHistoryPage as VendorPurchaseHistoryPageImpl } from '@/features/vendors/pages/VendorPurchaseHistoryPage'

export function VendorPurchaseHistoryPage() {
  return <VendorPurchaseHistoryPageImpl />
}
