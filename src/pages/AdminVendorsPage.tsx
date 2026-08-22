// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/admin/pages/AdminVendorsPage — edit that file, not this one.
import { AdminVendorsPage as AdminVendorsPageImpl } from '@/features/admin/pages/AdminVendorsPage'

export function AdminVendorsPage() {
  return <AdminVendorsPageImpl />
}
