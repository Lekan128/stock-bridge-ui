import { useCallback, useMemo } from 'react'
import { useIncomingStock } from '@/features/orders/hooks/useIncomingStock'
import { resolveIncoming, type ResolvedIncoming } from '@/features/orders/incomingStock'
import type { Product } from '@/features/products/types'

export interface IncomingTotals {
  units: number
  productCount: number
  /** Units already delivered and waiting on a receipt confirmation. 0 when not knowable. */
  awaitingReceiptUnits: number
  /** True when `units` is a floor rather than an exact figure. */
  approximate: boolean
}

export interface ProductIncoming {
  /** Incoming stock for one product: quantity, and which orders are bringing it. */
  incomingFor: (product: Product) => ResolvedIncoming
  totals: IncomingTotals
  loading: boolean
  /** True while the numbers come from the order fallback rather than from the product row. */
  derived: boolean
}

/**
 * The bridge between the inventory screens and incoming stock.
 *
 * `GET /api/products` does not send `incomingQuantity` today (see `Product.incomingQuantity` for
 * the precise gap), so this hook falls back to deriving it from the buyer's own open orders,
 * where each line's `outstandingQuantity` is — by the backend's own definition — exactly the
 * amount still sitting as incoming stock on that product row.
 *
 * The fallback switches itself off: the moment a product row arrives carrying `incomingQuantity`,
 * `derived` goes false and the inventory pages stop fetching order details entirely. Nothing here
 * invents a number; when neither source has one, the answer is zero and no badge is drawn.
 */
export function useProductIncoming(products: Product[] | undefined): ProductIncoming {
  const derived = !products || products.some((product) => product.incomingQuantity === undefined)
  const state = useIncomingStock(derived)

  const incomingFor = useCallback(
    (product: Product) => resolveIncoming(product.id, product.incomingQuantity, state),
    [state],
  )

  const totals = useMemo<IncomingTotals>(() => {
    if (!derived && products) {
      // The authoritative column is on every row, so the visible page is the honest scope.
      let units = 0
      let productCount = 0
      for (const product of products) {
        const quantity = product.incomingQuantity ?? 0
        if (quantity > 0) {
          units += quantity
          productCount += 1
        }
      }
      // The delivered-but-unconfirmed split lives on orders, not on the product row.
      return { units, productCount, awaitingReceiptUnits: 0, approximate: false }
    }

    let units = 0
    let awaitingReceiptUnits = 0
    for (const entry of state.byProductId.values()) {
      units += entry.quantity
      awaitingReceiptUnits += entry.awaitingReceiptQuantity
    }
    return {
      units,
      productCount: state.byProductId.size,
      awaitingReceiptUnits,
      approximate: state.truncated,
    }
  }, [derived, products, state])

  return { incomingFor, totals, loading: state.loading, derived }
}
