// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/admin/pages/AdminListingModerationPage — edit that file, not this one.
import { AdminListingModerationPage as AdminListingModerationPageImpl } from '@/features/admin/pages/AdminListingModerationPage'

export function AdminListingModerationPage() {
  return <AdminListingModerationPageImpl />
}
