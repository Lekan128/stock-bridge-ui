// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/storefront/pages/StorefrontHomePage — edit that file, not this one.
import { StorefrontHomePage as StorefrontHomePageImpl } from '@/features/storefront/pages/StorefrontHomePage'

export function StorefrontHomePage() {
  return <StorefrontHomePageImpl />
}
