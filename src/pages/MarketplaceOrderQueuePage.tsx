// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/marketplace/pages/MarketplaceOrderQueuePage — edit that file, not this one.
import { MarketplaceOrderQueuePage as MarketplaceOrderQueuePageImpl } from '@/features/marketplace/pages/MarketplaceOrderQueuePage'

export function MarketplaceOrderQueuePage() {
  return <MarketplaceOrderQueuePageImpl />
}
