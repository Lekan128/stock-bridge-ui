// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/admin/pages/AdminSettlementSettingsPage — edit that file, not this one.
import { AdminSettlementSettingsPage as AdminSettlementSettingsPageImpl } from '@/features/admin/pages/AdminSettlementSettingsPage'

export function AdminSettlementSettingsPage() {
  return <AdminSettlementSettingsPageImpl />
}
