// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/admin/pages/AdminVendorWaitlistPage — edit that file, not this one.
import { AdminVendorWaitlistPage as AdminVendorWaitlistPageImpl } from '@/features/admin/pages/AdminVendorWaitlistPage'

export function AdminVendorWaitlistPage() {
  return <AdminVendorWaitlistPageImpl />
}
