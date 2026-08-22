// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/vendor/pages/VendorPickupAddressesPage — edit that file, not this one.
import { VendorPickupAddressesPage as VendorPickupAddressesPageImpl } from '@/features/vendor/pages/VendorPickupAddressesPage'

export function VendorPickupAddressesPage() {
  return <VendorPickupAddressesPageImpl />
}
