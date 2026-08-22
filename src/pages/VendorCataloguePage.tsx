// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/vendor/pages/VendorCataloguePage — edit that file, not this one.
import { VendorCataloguePage as VendorCataloguePageImpl } from '@/features/vendor/pages/VendorCataloguePage'

export function VendorCataloguePage() {
  return <VendorCataloguePageImpl />
}
