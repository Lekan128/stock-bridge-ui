// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/vendors/pages/VendorDetailPage — edit that file, not this one.
import { VendorDetailPage as VendorDetailPageImpl } from '@/features/vendors/pages/VendorDetailPage'

export function VendorDetailPage() {
  return <VendorDetailPageImpl />
}
