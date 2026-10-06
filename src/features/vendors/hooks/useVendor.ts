import { queryKeys } from '@/data/queryKeys'
import { useApiQuery } from '@/data/useApiQuery'
import { vendorsApi } from '@/features/vendors/api/vendorsApi'
import type { CompanyVendorDetail } from '@/features/vendors/types'

/**
 * One vendor's detail: the row, the live seller behind it, spend to date and the products supplied
 * with their last purchase price — one request, because they are one screen.
 *
 * Purchase history is deliberately not in here. It is paginated and it is its own screen.
 */
export function useVendor(id: string | undefined) {
  const result = useApiQuery<CompanyVendorDetail>({
    queryKey: queryKeys.vendors.detail(id),
    queryFn: () => vendorsApi.get(id as string),
    fallbackError: 'Could not load this vendor.',
    enabled: id != null,
  })

  return { detail: result.data ?? null, loading: result.loading, error: result.error, refetch: result.refetch }
}
