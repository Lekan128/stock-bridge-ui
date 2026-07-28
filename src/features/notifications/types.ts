/** Server-side notification types (contract §4.9). */
export type NotificationType =
  | 'NEW_ORDER'
  | 'ORDER_STATUS_CHANGED'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_FAILED'
  | 'ORDER_DELIVERED'

/** A row from `notifications`, as `GET /api/notifications` returns it. */
export interface ServerNotification {
  id: string
  type: NotificationType
  title: string
  body: string | null
  /** In-app route, e.g. `/app/marketplace/orders/<id>`. Rendered as a Link when present. */
  link: string | null
  orderId: string | null
  readAt: string | null
  createdAt: string
}
