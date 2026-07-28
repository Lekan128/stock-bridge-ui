import { useState } from 'react'
import { PackageCheck } from 'lucide-react'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { QuantityStepper } from '@/components/QuantityStepper'
import { ordersApi } from '@/features/orders/api/ordersApi'
import type { Order, ReceiveOrderLine } from '@/features/orders/types'
import { ProductImage } from '@/features/products/components/ProductImage'
import { isAppError } from '@/types/api'
import { formatQuantity } from '@/utils/units'

export interface ReceiveOrderModalProps {
  order: Order
  onClose: () => void
  /** Receives the updated order so the caller can re-render without a second round trip. */
  onSuccess: (order: Order, receivedUnits: number, fullyReceived: boolean) => void
}

/**
 * Confirming a delivery — the single most consequential button a buyer presses.
 *
 * Everything else in the marketplace moves an order between states. This moves *stock*: each unit
 * confirmed here stops being incoming and becomes real, usable, sellable inventory, with a stock
 * movement written against it at the price actually paid. The copy says so in those words,
 * because a buyer who thinks this is a receipt acknowledgement will not understand why their
 * inventory changed.
 *
 * **Partial receipt is the normal case in wholesale**, not an edge case: 8 of 10 bags arrive
 * today and 2 follow tomorrow. Each line therefore gets its own quantity, defaulted to what is
 * still outstanding, and the remainder stays incoming with the order still DELIVERED.
 */
export function ReceiveOrderModal({ order, onClose, onSuccess }: ReceiveOrderModalProps) {
  const outstandingItems = order.items.filter((item) => item.outstandingQuantity > 0)
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(outstandingItems.map((item) => [item.id, item.outstandingQuantity])),
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalOutstanding = outstandingItems.reduce((sum, item) => sum + item.outstandingQuantity, 0)
  const totalSelected = Object.values(quantities).reduce((sum, value) => sum + value, 0)
  const isPartial = totalSelected > 0 && totalSelected < totalOutstanding

  async function handleSubmit() {
    // @Positive on the backend rejects a zero-quantity line, so "nothing arrived for this line"
    // is expressed by omitting it rather than by sending a 0.
    const lines: ReceiveOrderLine[] = Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([orderItemId, quantity]) => ({ orderItemId, quantity }))

    if (lines.length === 0) {
      setError('Enter how much of at least one line arrived.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const updated = await ordersApi.receive(order.id, { lines })
      onSuccess(updated, totalSelected, updated.fullyReceived)
    } catch (err: unknown) {
      setError(isAppError(err) ? err.message : 'Could not confirm the delivery. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Confirm what you received"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} loading={submitting} disabled={totalSelected === 0}>
            <PackageCheck className="h-4 w-4" aria-hidden="true" />
            Add {totalSelected} to my stock
          </Button>
        </>
      }
    >
      <div className="rounded-md border border-accent-200 bg-accent-50 px-3 py-2.5">
        <p className="text-sm text-accent-900">
          <strong className="font-semibold">This adds the items to your usable inventory.</strong> Until you confirm,
          they are held as incoming stock and cannot be used or sold.
        </p>
      </div>

      <p className="mt-4 text-sm text-neutral-600">
        Check each line against what physically arrived. The quantities below are pre-filled with everything still
        outstanding — change any that came up short.
      </p>

      <ul className="mt-3 divide-y divide-neutral-100">
        {outstandingItems.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
            <ProductImage
              src={item.imageUrl}
              alt={item.productName}
              className="h-10 w-10 shrink-0 rounded-md"
              iconClassName="h-4 w-4"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-900">{item.productName}</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                Ordered {formatQuantity(item.quantity, item.unitOfMeasure)}
                {item.receivedQuantity > 0 ? ` · ${item.receivedQuantity} already received` : ''} ·{' '}
                <span className="font-medium text-warning-800">{item.outstandingQuantity} outstanding</span>
              </p>
            </div>
            <QuantityStepper
              value={quantities[item.id] ?? 0}
              min={0}
              max={item.outstandingQuantity}
              size="sm"
              unitOfMeasure={item.unitOfMeasure}
              onChange={(value) => setQuantities((prev) => ({ ...prev, [item.id]: value }))}
              label={`Quantity of ${item.productName} received`}
            />
          </li>
        ))}
      </ul>

      {isPartial && (
        <p className="mt-3 rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-900">
          You are confirming {totalSelected} of {totalOutstanding} outstanding units. The remaining{' '}
          {totalOutstanding - totalSelected} stay as incoming stock and this order stays open, so you can confirm the
          rest when it arrives.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {error}
        </p>
      )}
    </Modal>
  )
}
