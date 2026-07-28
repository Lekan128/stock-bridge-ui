// Thin route-level wrapper, matching the existing src/pages convention.
// The implementation lives in @/features/addresses/pages/AddressListPage — edit that file, not this one.
import { AddressListPage as AddressListPageImpl } from '@/features/addresses/pages/AddressListPage'

export function AddressListPage() {
  return <AddressListPageImpl />
}
