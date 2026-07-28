// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/marketplace/pages/MarketplaceAnalyticsPage — edit that file, not this one.
import { MarketplaceAnalyticsPage as MarketplaceAnalyticsPageImpl } from '@/features/marketplace/pages/MarketplaceAnalyticsPage'

export function MarketplaceAnalyticsPage() {
  return <MarketplaceAnalyticsPageImpl />
}
