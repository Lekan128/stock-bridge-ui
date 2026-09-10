// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/vendor/pages/VendorStatementPage — edit that file, not this one.
import { VendorStatementPage as VendorStatementPageImpl } from '@/features/vendor/pages/VendorStatementPage'

export function VendorStatementPage() {
  return <VendorStatementPageImpl />
}
