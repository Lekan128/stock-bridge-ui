import { useState } from 'react'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { ordersApi } from '@/features/orders/api/ordersApi'
import type { Order } from '@/features/orders/types'
import { isAppError } from '@/types/api'

export interface CancelOrderModalProps {
  order: Order
  onClose: () => void
  onSuccess: (order: Order) => void
}

const MAX_REASON = 500

/**
 * Cancellation, with a reason. The reason is optional server-side but asked for here on purpose:
 * a cancellation with no explanation is the one thing ops can never learn from.
 *
 * Only ever rendered when the server said `canCancel` — the window is PENDING_PAYMENT/PLACED, and
 * that rule stays on the backend where it cannot drift.
 */
export function CancelOrderModal({ order, onClose, onSuccess }: CancelOrderModalProps) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // An order past PENDING_PAYMENT already created incoming stock, and cancelling hands the
  // un-received remainder back. Saying so prevents "where did my pending delivery go?".
  const hasIncoming = order.status !== 'PENDING_PAYMENT'

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const updated = await ordersApi.cancel(order.id, reason.trim())
      onSuccess(updated)
    } catch (err: unknown) {
      setError(isAppError(err) ? err.message : 'Could not cancel this order. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Cancel order ${order.orderNumber}?`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Keep order
          </Button>
          <Button variant="danger" onClick={() => void handleSubmit()} loading={submitting}>
            Cancel order
          </Button>
        </>
      }
    >
      <p className="text-sm text-neutral-600">
        This cannot be undone. Once ProcurePal starts preparing an order it can no longer be cancelled here.
      </p>
      {hasIncoming && (
        <p className="mt-3 rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-900">
          The incoming stock this order added to your inventory will be removed. Anything you have already confirmed
          as received stays — it is real stock in your store and a cancellation cannot un-deliver it.
        </p>
      )}

      <div className="mt-4">
        <label htmlFor="cancel-reason" className="mb-1.5 block text-sm font-medium text-neutral-700">
          Why are you cancelling? <span className="font-normal text-neutral-400">(optional)</span>
        </label>
        <textarea
          id="cancel-reason"
          rows={3}
          maxLength={MAX_REASON}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. ordered the wrong size, no longer needed"
          className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
        <p className="mt-1.5 text-xs text-neutral-500">
          {reason.length}/{MAX_REASON} — ProcurePal sees this and it appears on the order's history.
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {error}
        </p>
      )}
    </Modal>
  )
}
