import { useContext } from 'react'
import { LowStockAlertsContext, type LowStockAlertsContextValue } from '@/features/products/context/LowStockAlertsContext'

export function useLowStockAlerts(): LowStockAlertsContextValue {
  const ctx = useContext(LowStockAlertsContext)
  if (!ctx) {
    throw new Error('useLowStockAlerts must be used within a LowStockAlertsProvider')
  }
  return ctx
}
