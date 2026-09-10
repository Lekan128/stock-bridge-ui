// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/vendor/pages/VendorSalesAnalyticsPage — edit that file, not this one.
import { VendorSalesAnalyticsPage as VendorSalesAnalyticsPageImpl } from '@/features/vendor/pages/VendorSalesAnalyticsPage'

export function VendorSalesAnalyticsPage() {
  return <VendorSalesAnalyticsPageImpl />
}
