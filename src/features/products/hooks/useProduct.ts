import { useEffect, useState } from 'react'
import { productsApi } from '@/features/products/api/productsApi'
import type { Product } from '@/features/products/types'
import { isAppError } from '@/types/api'

export function useProduct(id: string | undefined) {
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setError(null)

    productsApi
      .get(id)
      .then((response) => {
        if (!cancelled) setProduct(response)
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
  }, [id])

  return { product, setProduct, loading, error }
}
