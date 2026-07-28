import { api } from '@/api/client'
import type { PageResponse } from '@/features/products/types'
import type { ServerNotification } from '@/features/notifications/types'

/** The raw wire shape: `spring.jackson.default-property-inclusion: non_null` omits null fields. */
type RawNotification = Omit<ServerNotification, 'body' | 'link' | 'orderId' | 'readAt'> &
  Partial<Pick<ServerNotification, 'body' | 'link' | 'orderId' | 'readAt'>>

/**
 * Normalises absent-because-null fields to explicit `null`.
 *
 * This is not cosmetic. An *unread* notification has no `readAt`, so it arrives with the key
 * missing entirely, and the bell decides what is unread with `readAt === null` — which
 * `undefined` fails. Without this the badge would sit at zero forever while unread rows piled up.
 */
function toServerNotification(raw: RawNotification): ServerNotification {
  return {
    id: raw.id,
    type: raw.type,
    title: raw.title,
    body: raw.body ?? null,
    link: raw.link ?? null,
    orderId: raw.orderId ?? null,
    readAt: raw.readAt ?? null,
    createdAt: raw.createdAt,
  }
}

export interface NotificationListParams {
  unreadOnly?: boolean
  page?: number
  size?: number
}

export const notificationsApi = {
  list: (params: NotificationListParams) =>
    api.get<PageResponse<RawNotification>>('/api/notifications', { params }).then((r) => ({
      ...r.data,
      content: r.data.content.map(toServerNotification),
    })),

  /**
   * The unread badge count. There is no bespoke count field by design — the page's
   * `totalElements` under `unreadOnly=true` *is* the count, so `size: 1` fetches the number
   * without the rows.
   */
  unreadCount: () =>
    api
      .get<PageResponse<RawNotification>>('/api/notifications', { params: { unreadOnly: true, size: 1 } })
      .then((r) => r.data.totalElements),

  markRead: (id: string) =>
    api.post<RawNotification>(`/api/notifications/${id}/read`).then((r) => toServerNotification(r.data)),

  markAllRead: () => api.post<{ markedRead: number }>('/api/notifications/read-all').then((r) => r.data),
}
