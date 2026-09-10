// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/vendors/pages/VendorListPage — edit that file, not this one.
import { VendorListPage as VendorListPageImpl } from '@/features/vendors/pages/VendorListPage'

export function VendorListPage() {
  return <VendorListPageImpl />
}
