// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/vendor/pages/VendorDashboardPage — edit that file, not this one.
import { VendorDashboardPage as VendorDashboardPageImpl } from '@/features/vendor/pages/VendorDashboardPage'

export function VendorDashboardPage() {
  return <VendorDashboardPageImpl />
}
