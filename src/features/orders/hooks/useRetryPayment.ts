import { useCallback, useState } from 'react'
import { useToast } from '@/components/useToast'
import { ordersApi } from '@/features/orders/api/ordersApi'
import { isAppError } from '@/types/api'

/**
 * "Retry payment" for an order left `PENDING_PAYMENT` by a failed or abandoned checkout.
 *
 * Two rules the backend imposes and this hook exists to honour:
 *   1. **Always mint a fresh checkout URL.** Monnify expires one 40 minutes after issue, so the
 *      URL from the original attempt is almost always dead by the time someone retries. There is
 *      deliberately nothing cached here.
 *   2. **503 means Monnify is not configured**, not that the order is broken. The order is still
 *      alive and payable, so we say so instead of dead-ending the buyer on a red error.
 */
export function useRetryPayment() {
  const { showToast } = useToast()
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null)

  const retry = useCallback(
    async (orderId: string) => {
      setPendingOrderId(orderId)
      try {
        const { checkoutUrl } = await ordersApi.initializePayment(orderId)
        // A full navigation, not a router push: the checkout is Monnify's own hosted page.
        window.location.assign(checkoutUrl)
      } catch (err: unknown) {
        const status = isAppError(err) ? err.status : 0
        if (status === 503) {
          showToast(
            'Card and transfer payments are unavailable right now. Your order is still open — contact ProcurePal to arrange payment on delivery.',
            'error',
          )
        } else if (status === 409) {
          showToast('This order has already been paid for. Refresh to see its current status.', 'error')
        } else {
          showToast(isAppError(err) ? err.message : 'Could not start the payment. Please try again.', 'error')
        }
        setPendingOrderId(null)
      }
      // Deliberately no `finally`: on success the browser is navigating away and clearing the
      // spinner would just flash the button back to idle mid-redirect.
    },
    [showToast],
  )

  return { retry, pendingOrderId, isRetrying: (orderId: string) => pendingOrderId === orderId }
}
