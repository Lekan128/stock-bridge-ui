import { useEffect, useState } from 'react'
import { stockApi } from '@/features/products/api/stockApi'
import type { PageResponse, StockMovement } from '@/features/products/types'
import { isAppError } from '@/types/api'

export function useStockHistory(productId: string | undefined, page: number) {
  const [data, setData] = useState<PageResponse<StockMovement> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!productId) return
    let cancelled = false
    setLoading(true)
    setError(null)

    stockApi
      .history(productId, page)
      .then((response) => {
        if (!cancelled) setData(response)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(isAppError(err) ? err.message : 'Something went wrong. Please try again.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [productId, page, reloadToken])

  return { data, loading, error, refetch: () => setReloadToken((t) => t + 1) }
}
