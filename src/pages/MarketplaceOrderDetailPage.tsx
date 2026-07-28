// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/marketplace/pages/MarketplaceOrderDetailPage — edit that file, not this one.
import { MarketplaceOrderDetailPage as MarketplaceOrderDetailPageImpl } from '@/features/marketplace/pages/MarketplaceOrderDetailPage'

export function MarketplaceOrderDetailPage() {
  return <MarketplaceOrderDetailPageImpl />
}
