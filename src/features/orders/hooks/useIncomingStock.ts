import { useEffect, useSyncExternalStore } from 'react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import {
  getIncomingStockSnapshot,
  loadIncomingStock,
  resetIncomingStock,
  subscribeToIncomingStock,
  type IncomingStockState,
} from '@/features/orders/incomingStock'

/**
 * Subscribes to the shared incoming-stock derivation (see `incomingStock.ts` for the full why).
 *
 * `enabled` lets a caller skip the work entirely — the inventory list passes `false` once every
 * product row on screen already carries `incomingQuantity` from the API, so the fallback costs
 * nothing the day the backend DTO exposes the column.
 */
export function useIncomingStock(enabled = true): IncomingStockState {
  const { isAuthenticated, user } = useAuth()
  // Orders are the only source of the derivation, so without VIEW_ORDERS there is nothing to read
  // and firing the request would just log a 403 on every inventory page load.
  const canViewOrders = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.VIEW_ORDERS)
  const active = enabled && isAuthenticated && canViewOrders

  const state = useSyncExternalStore(subscribeToIncomingStock, getIncomingStockSnapshot)

  useEffect(() => {
    if (!active) return
    void loadIncomingStock()
  }, [active])

  useEffect(() => {
    // Session boundary: never let one tenant's deliveries survive into another's session.
    if (!isAuthenticated) resetIncomingStock()
  }, [isAuthenticated])

  return state
}
