// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/storefront/pages/SellerStorefrontPage — edit that file, not this one.
import { SellerStorefrontPage as SellerStorefrontPageImpl } from '@/features/storefront/pages/SellerStorefrontPage'

export function SellerStorefrontPage() {
  return <SellerStorefrontPageImpl />
}
