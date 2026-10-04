import { queryKeys } from '@/data/queryKeys'
import { useApiQuery } from '@/data/useApiQuery'
import type { PageResponse } from '@/features/products/types'
import { vendorsApi } from '@/features/vendors/api/vendorsApi'
import type { CompanyVendor, VendorListParams } from '@/features/vendors/types'

/**
 * The directory list. Paged rather than fetched whole (unlike the address book): a company with a
 * real supplier list has hundreds of these, and every marketplace seller they buy from adds one
 * automatically without anybody asking.
 */
export function useVendors(params: VendorListParams) {
  const result = useApiQuery<PageResponse<CompanyVendor>>({
    queryKey: queryKeys.vendors.list(params),
    queryFn: () => vendorsApi.list(params),
    fallbackError: 'Could not load your vendor directory.',
    keepPrevious: true,
    persist: !params.search,
  })

  return { data: result.data ?? null, loading: result.loading, error: result.error, refetch: result.refetch }
}
