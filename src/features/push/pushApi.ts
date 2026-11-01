import { api } from '@/api/client'

/** What the browser's PushSubscription.toJSON() gives, as the server takes it. */
export interface PushSubscriptionPayload {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export const pushApi = {
  key: () => api.get<{ publicKey: string }>('/api/push/key').then((r) => r.data.publicKey),
  subscribe: (subscription: PushSubscriptionPayload) => api.post<void>('/api/push/subscriptions', subscription).then(() => undefined),
  unsubscribe: (endpoint: string) => api.delete<void>('/api/push/subscriptions', { data: { endpoint } }).then(() => undefined),
}
