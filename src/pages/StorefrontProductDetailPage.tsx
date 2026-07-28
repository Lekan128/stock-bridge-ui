// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/storefront/pages/StorefrontProductDetailPage — edit that file, not this one.
import { StorefrontProductDetailPage as StorefrontProductDetailPageImpl } from '@/features/storefront/pages/StorefrontProductDetailPage'

export function StorefrontProductDetailPage() {
  return <StorefrontProductDetailPageImpl />
}
