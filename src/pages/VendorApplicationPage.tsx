// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/vendorWaitlist/pages/VendorApplicationPage — edit that file, not this one.
import { VendorApplicationPage as VendorApplicationPageImpl } from '@/features/vendorWaitlist/pages/VendorApplicationPage'

export function VendorApplicationPage() {
  return <VendorApplicationPageImpl />
}
