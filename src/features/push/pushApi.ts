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
  /** Each person's own choices, by kind (V104). */
  prefs: () => api.get<PushPrefs>('/api/push/prefs').then((r) => r.data),
  setPref: (kind: keyof PushPrefs, on: boolean) => api.put<PushPrefs>('/api/push/prefs', { kind, on }).then((r) => r.data),
}

/** New tickets for the areas someone works in, and Ready for the tables they sent to. */
export interface PushPrefs {
  TICKETS_NEW: boolean
  TICKETS_READY: boolean
}
