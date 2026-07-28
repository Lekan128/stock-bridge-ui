// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/marketplace/pages/MarketplaceProductsPage — edit that file, not this one.
import { MarketplaceProductsPage as MarketplaceProductsPageImpl } from '@/features/marketplace/pages/MarketplaceProductsPage'

export function MarketplaceProductsPage() {
  return <MarketplaceProductsPageImpl />
}
