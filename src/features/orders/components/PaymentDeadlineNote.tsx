import { formatOrderDateTime } from '@/features/orders/formatters'

/**
 * "Pay by …" for an order awaiting payment. This replaces the reminder email: unpaid orders are
 * cancelled automatically, quietly, so the deadline has to be visible where the buyer looks.
 * Renders nothing when the server sent no deadline (any status other than `PENDING_PAYMENT`).
 */
export function PaymentDeadlineNote({ paymentDueBy, className = '' }: { paymentDueBy?: string; className?: string }) {
  if (!paymentDueBy) return null
  return (
    <p className={`text-sm text-neutral-700 ${className}`}>
      Pay by <strong className="font-semibold text-neutral-900">{formatOrderDateTime(paymentDueBy)}</strong>. Unpaid
      orders are cancelled automatically after that, and you will not be charged.
    </p>
  )
}
