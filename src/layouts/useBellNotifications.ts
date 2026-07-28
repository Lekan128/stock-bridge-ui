import { useMemo } from 'react'
import {
  AlertTriangle,
  BellRing,
  CircleCheck,
  PackageCheck,
  ShoppingCart,
  TriangleAlert,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { useServerNotifications } from '@/features/notifications/hooks/useServerNotifications'
import type { NotificationType } from '@/features/notifications/types'
import { useLowStockAlerts } from '@/features/products/hooks/useLowStockAlerts'

export type BellNotificationTone = 'warning' | 'info' | 'success' | 'danger'

/**
 * One normalized row for the bell, whatever it came from. The bell renders only this shape, which
 * is what lets a second data source be added without touching the component.
 */
export interface BellNotification {
  id: string
  title: string
  /** Secondary line — the low-stock numbers, or the notification body. */
  detail: string | null
  /** In-app route. Omitted when the viewer lacks the permission to open the target. */
  link: string | null
  icon: LucideIcon
  tone: BellNotificationTone
  /** ISO timestamp used for ordering. Client-side alerts have none and sort first. */
  createdAt: string | null
  unread: boolean
}

const serverIcons: Record<NotificationType, LucideIcon> = {
  NEW_ORDER: ShoppingCart,
  ORDER_STATUS_CHANGED: Truck,
  PAYMENT_RECEIVED: CircleCheck,
  PAYMENT_FAILED: TriangleAlert,
  ORDER_DELIVERED: PackageCheck,
}

const serverTones: Record<NotificationType, BellNotificationTone> = {
  NEW_ORDER: 'info',
  ORDER_STATUS_CHANGED: 'info',
  PAYMENT_RECEIVED: 'success',
  PAYMENT_FAILED: 'danger',
  ORDER_DELIVERED: 'success',
}

/**
 * Merges every notification source into one ordered list for the topbar bell.
 *
 * Sources today:
 *   1. Low-stock alerts — client-derived from the polled low-stock endpoint, never "read".
 *   2. Server notifications — see the extension point in `useServerNotifications` (M7).
 *
 * A third source only has to produce `BellNotification[]` and be concatenated below.
 */
export function useBellNotifications() {
  const { user } = useAuth()
  const lowStock = useLowStockAlerts()
  const server = useServerNotifications()

  const canViewProducts = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.VIEW_PRODUCTS)

  const notifications = useMemo<BellNotification[]>(() => {
    const lowStockRows: BellNotification[] = lowStock.alerts.map((product) => ({
      id: `low-stock:${product.id}`,
      title: product.name,
      detail: `${product.quantityOnHand} on hand · threshold ${product.lowStockThreshold ?? '—'}`,
      // No link for a user who can't open the product page — a dead-ending row is worse than plain text.
      link: canViewProducts ? `/app/products/${product.id}` : null,
      icon: AlertTriangle,
      tone: 'warning',
      createdAt: null,
      unread: true,
    }))

    const serverRows: BellNotification[] = server.notifications.map((notification) => ({
      id: `notification:${notification.id}`,
      title: notification.title,
      detail: notification.body,
      link: notification.link,
      icon: serverIcons[notification.type] ?? BellRing,
      tone: serverTones[notification.type] ?? 'info',
      createdAt: notification.createdAt,
      unread: notification.readAt === null,
    }))

    // Newest first; the timestamp-less low-stock alerts lead, since "you are about to run out"
    // outranks an order update from an hour ago.
    return [...lowStockRows, ...serverRows].sort((a, b) => {
      if (a.createdAt === null && b.createdAt === null) return 0
      if (a.createdAt === null) return -1
      if (b.createdAt === null) return 1
      return b.createdAt.localeCompare(a.createdAt)
    })
  }, [lowStock.alerts, server.notifications, canViewProducts])

  const unreadCount = notifications.filter((notification) => notification.unread).length

  return {
    notifications,
    unreadCount,
    /** True only while nothing has ever loaded — the panel shows a spinner instead of "all clear". */
    loading: (lowStock.loading && !lowStock.hasLoadedOnce) || server.loading,
    hasLoadedOnce: lowStock.hasLoadedOnce,
    error: lowStock.error ?? server.error,
    markAllRead: server.markAllRead,
    /** True when there is anything a "mark all read" action could act on. */
    canMarkAllRead: server.unreadCount > 0,
  }
}
