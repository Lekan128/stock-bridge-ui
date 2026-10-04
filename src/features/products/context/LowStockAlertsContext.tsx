import { createContext, type ReactNode } from 'react'
import { useAuth } from '@/auth/useAuth'
import { queryKeys } from '@/data/queryKeys'
import { useApiQuery } from '@/data/useApiQuery'
import { productsApi } from '@/features/products/api/productsApi'
import type { Product } from '@/features/products/types'

// Polling MVP: re-fetches on an interval plus on-demand via refetch() after stock
// mutations. A future enhancement could replace this with a push/websocket channel.
const POLL_INTERVAL_MS = 3 * 60 * 1000

export interface LowStockAlertsContextValue {
  alerts: Product[]
  count: number
  loading: boolean
  hasLoadedOnce: boolean
  error: string | null
  refetch: () => void
}

export const LowStockAlertsContext = createContext<LowStockAlertsContextValue | null>(null)

const NO_ALERTS: Product[] = []

export function LowStockAlertsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  // Cached like every other inventory read (A2): the bell and the Low Stock card show the last
  // known list at once, offline included. Polls every few minutes while the tab is visible
  // (TanStack pauses intervals in a hidden tab), catches up when the tab is shown again, and
  // refetches on reconnect.
  const result = useApiQuery<Product[]>({
    queryKey: queryKeys.products.lowStock,
    queryFn: () => productsApi.lowStock(),
    fallbackError: 'Could not load low-stock alerts.',
    enabled: isAuthenticated,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  })

  const alerts = isAuthenticated ? (result.data ?? NO_ALERTS) : NO_ALERTS
  const value: LowStockAlertsContextValue = {
    alerts,
    count: alerts.length,
    loading: result.fetching,
    hasLoadedOnce: result.data !== undefined || result.error != null,
    error: result.error,
    refetch: result.refetch,
  }

  return <LowStockAlertsContext.Provider value={value}>{children}</LowStockAlertsContext.Provider>
}
