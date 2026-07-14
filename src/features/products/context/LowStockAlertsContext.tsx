import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '@/auth/useAuth'
import { productsApi } from '@/features/products/api/productsApi'
import type { Product } from '@/features/products/types'
import { isAppError } from '@/types/api'

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

export function LowStockAlertsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [alerts, setAlerts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!isAuthenticated) {
      setAlerts([])
      setHasLoadedOnce(false)
      setError(null)
      return
    }

    let cancelled = false

    function load() {
      setLoading(true)
      productsApi
        .lowStock()
        .then((data) => {
          if (!cancelled) {
            setAlerts(data)
            setError(null)
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(isAppError(err) ? err.message : 'Could not load low-stock alerts.')
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false)
            setHasLoadedOnce(true)
          }
        })
    }

    load()
    const intervalId = setInterval(load, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [isAuthenticated, reloadToken])

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])

  const value: LowStockAlertsContextValue = {
    alerts,
    count: alerts.length,
    loading,
    hasLoadedOnce,
    error,
    refetch,
  }

  return <LowStockAlertsContext.Provider value={value}>{children}</LowStockAlertsContext.Provider>
}
