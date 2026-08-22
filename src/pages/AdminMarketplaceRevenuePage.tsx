// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/admin/pages/AdminMarketplaceRevenuePage — edit that file, not this one.
import { AdminMarketplaceRevenuePage as AdminMarketplaceRevenuePageImpl } from '@/features/admin/pages/AdminMarketplaceRevenuePage'

export function AdminMarketplaceRevenuePage() {
  return <AdminMarketplaceRevenuePageImpl />
}
