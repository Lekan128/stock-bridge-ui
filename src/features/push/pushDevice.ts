import { useSyncExternalStore } from 'react'
import { pushApi, type PushSubscriptionPayload } from '@/features/push/pushApi'
import { isIos, isStandalone } from '@/pwa/serviceWorker'

/**
 * Notifications on this device (STOCK_AREAS_PART_5.md): whether they're on, and turning them on and off. One per
 * device, so a module-level store, like the service worker's: the offer on Inventory and the switch on Profile
 * read the same answer.
 *
 * - `unsupported`: this browser can't (or the app's worker isn't there - `npm run dev`).
 * - `home-screen`: an iPhone or iPad in a Safari tab: only the app added to the Home Screen gets them.
 * - `blocked`: they said no to the browser's question; only the browser's site settings undo that.
 */
export type PushState = 'checking' | 'unsupported' | 'home-screen' | 'blocked' | 'off' | 'on'

let state: PushState = 'checking'
let started = false
const listeners = new Set<() => void>()

function set(next: PushState): void {
  state = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (!started) {
    started = true
    void check()
  }
  return () => {
    listeners.delete(listener)
  }
}

export function usePushState(): PushState {
  return useSyncExternalStore(subscribe, () => state, () => state)
}

/** How long a first visit waits for the app's worker to install before saying this device can't. */
const WORKER_WAIT_MS = 15_000

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  const now = await navigator.serviceWorker.getRegistration('/').catch(() => undefined)
  if (now || !import.meta.env.PROD) return now ?? null
  // A first visit: the worker is still installing (pwa/serviceWorker.ts registers it on the workspace's first load).
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), WORKER_WAIT_MS)),
  ])
}

function supported(): boolean {
  return typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window
}

function payload(subscription: PushSubscription): PushSubscriptionPayload {
  const json = subscription.toJSON()
  return { endpoint: subscription.endpoint, keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' } }
}

/** Where things stand on this device; a subscription it already has is told to the server again (its account may differ). */
async function check(): Promise<void> {
  if (!supported()) {
    set(isIos() && !isStandalone() ? 'home-screen' : 'unsupported')
    return
  }
  const worker = await registration()
  if (!worker) {
    set('unsupported')
    return
  }
  if (Notification.permission === 'denied') {
    set('blocked')
    return
  }
  const existing = await worker.pushManager.getSubscription().catch(() => null)
  if (existing && Notification.permission === 'granted') {
    set('on')
    void pushApi.subscribe(payload(existing)).catch(() => undefined)
  } else {
    set('off')
  }
}

function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64Url.length % 4)) % 4)
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/** Asks the browser, then subscribes. The state it ends in: `on`, or `blocked` / `off` when they said no. */
export async function turnPushOn(): Promise<PushState> {
  const worker = await registration()
  if (!worker || !supported()) return state
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    set(permission === 'denied' ? 'blocked' : 'off')
    return state
  }
  const key = await pushApi.key()
  const existing = await worker.pushManager.getSubscription()
  const subscription = existing ?? (await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }))
  await pushApi.subscribe(payload(subscription))
  set('on')
  return state
}

export async function turnPushOff(): Promise<void> {
  const worker = await registration()
  const existing = await worker?.pushManager.getSubscription().catch(() => null)
  if (existing) {
    await pushApi.unsubscribe(existing.endpoint).catch(() => undefined)
    await existing.unsubscribe().catch(() => false)
  }
  if (state === 'on') set('off')
}

/**
 * Signing out: this device stops hearing about the person who signed out (a shared phone shouldn't keep getting
 * their notifications). Called while the session can still reach the server; quiet if it can't.
 */
export async function forgetPushOnThisDevice(): Promise<void> {
  if (!supported()) return
  await turnPushOff().catch(() => undefined)
}

/** Request notifications still showing on this device, by request id. */
export async function shownRequestNotifications(): Promise<Map<string, Notification>> {
  const worker = await registration()
  const shown = new Map<string, Notification>()
  if (!worker || !('getNotifications' in worker)) return shown
  for (const notification of await worker.getNotifications().catch(() => [] as Notification[])) {
    if (notification.tag?.startsWith('request-')) shown.set(notification.tag.slice('request-'.length), notification)
  }
  return shown
}

/** "phone" or "computer", for the words around the switch. */
export function thisDevice(): 'phone' | 'computer' {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches ? 'phone' : 'computer'
}
