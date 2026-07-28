import { Ban, CircleCheck, Clock, ClipboardList, PackageCheck, Settings, Truck, Warehouse } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { ORDER_STATUS_LABELS, ORDER_STATUS_VARIANTS, type OrderStatus } from '@/constants/orderStatus'

// Several statuses share the navy `info` variant on purpose (see ORDER_STATUS_VARIANTS), so the
// icon is what distinguishes "being prepared" from "out for delivery" at a glance.
const icons: Record<OrderStatus, typeof Clock> = {
  PENDING_PAYMENT: Clock,
  PLACED: ClipboardList,
  CONFIRMED: CircleCheck,
  PROCESSING: Settings,
  OUT_FOR_DELIVERY: Truck,
  DELIVERED: PackageCheck,
  RECEIVED: Warehouse,
  CANCELLED: Ban,
}

export interface OrderStatusBadgeProps {
  status: OrderStatus
  /** Hide the icon where space is tight (dense table cells). */
  showIcon?: boolean
  className?: string
}

export function OrderStatusBadge({ status, showIcon = true, className = '' }: OrderStatusBadgeProps) {
  const Icon = icons[status]

  return (
    <Badge variant={ORDER_STATUS_VARIANTS[status]} className={className}>
      {showIcon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  )
}
