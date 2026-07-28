import { CircleCheck, Clock, TriangleAlert, Undo2, Wallet } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_VARIANTS, type PaymentStatus } from '@/constants/orderStatus'

// PENDING and ON_DELIVERY are both amber (money not collected yet) but mean very different
// things — one is a payment we're waiting on, the other is a deliberate pay-on-delivery choice —
// so the icon carries that distinction.
const icons: Record<PaymentStatus, typeof Clock> = {
  PENDING: Clock,
  ON_DELIVERY: Wallet,
  PAID: CircleCheck,
  FAILED: TriangleAlert,
  REFUNDED: Undo2,
}

export interface PaymentStatusBadgeProps {
  status: PaymentStatus
  showIcon?: boolean
  className?: string
}

export function PaymentStatusBadge({ status, showIcon = true, className = '' }: PaymentStatusBadgeProps) {
  const Icon = icons[status]

  return (
    <Badge variant={PAYMENT_STATUS_VARIANTS[status]} className={className}>
      {showIcon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {PAYMENT_STATUS_LABELS[status]}
    </Badge>
  )
}
