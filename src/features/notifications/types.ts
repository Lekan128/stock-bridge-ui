/** Server-side notification types (contract §4.9). */
export type NotificationType =
  | 'NEW_ORDER'
  | 'ORDER_STATUS_CHANGED'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_FAILED'
  | 'ORDER_DELIVERED'
  | 'ACCOUNT_SETTING_CHANGED'
  /** Stock sent to a branch the reader works at (MULTI_BRANCH_UX_PLAN.md §5.13). */
  | 'TRANSFER_ON_THE_WAY'
  /** A waybill the reader sent, or any as an owner, arrived short. */
  | 'TRANSFER_RECEIVED_SHORT'

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
