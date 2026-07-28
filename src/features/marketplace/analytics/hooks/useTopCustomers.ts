import { marketplaceAnalyticsApi } from '@/features/marketplace/analytics/api/marketplaceAnalyticsApi'
import { useAnalyticsResource } from '@/features/marketplace/analytics/hooks/useAnalyticsResource'
import type { AnalyticsRangeParams, CustomerMetric, TopCustomerEntry } from '@/features/marketplace/analytics/types'

type Params = AnalyticsRangeParams & { metric: CustomerMetric; limit: number }

export function useTopCustomers(params: Params) {
  return useAnalyticsResource<Params, TopCustomerEntry[]>(marketplaceAnalyticsApi.topCustomers, params)
}
