import { CircleCheck, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, buttonClassName } from '@/components/Button'
import { Modal } from '@/components/Modal'
import type { ReorderResult } from '@/features/orders/types'

export interface ReorderResultModalProps {
  result: ReorderResult
  onClose: () => void
}

/**
 * What actually made it into the cart.
 *
 * Reorder is best-effort by design — a six-month-old order routinely contains something
 * ProcurePal has since discontinued — and the backend names every line it had to drop. Swallowing
 * that and toasting "added to cart" would leave the buyer to diff two carts by eye and discover
 * the gap at delivery. So the skipped lines are shown, by name, with the server's own reason.
 */
export function ReorderResultModal({ result, onClose }: ReorderResultModalProps) {
  const skipped = result.skipped ?? []

  return (
    <Modal
      open
      onClose={onClose}
      title={result.addedCount > 0 ? 'Added to your cart' : 'Nothing could be added'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep browsing
          </Button>
          {result.addedCount > 0 && (
            <Link to="/cart" className={buttonClassName('primary')}>
              Go to cart
            </Link>
          )}
        </>
      }
    >
      {result.addedCount > 0 ? (
        <p className="flex items-start gap-2 text-sm text-neutral-700">
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" aria-hidden="true" />
          <span>
            <strong className="font-medium text-neutral-900">
              {result.addedCount} {result.addedCount === 1 ? 'line' : 'lines'}
            </strong>{' '}
            went into your cart. Your cart is shared across your company, so a colleague may have added to it too.
          </span>
        </p>
      ) : (
        <p className="text-sm text-neutral-700">
          None of the products on this order are available to buy right now.
        </p>
      )}

      {skipped.length > 0 && (
        <div className="mt-4 rounded-md border border-warning-200 bg-warning-50 p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-warning-900">
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            {skipped.length} {skipped.length === 1 ? 'line was' : 'lines were'} skipped
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {skipped.map((line) => (
              <li key={line.productId} className="text-sm text-warning-900">
                <span className="font-medium">{line.productName}</span>
                <span className="text-warning-800"> — {line.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}
