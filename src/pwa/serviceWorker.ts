import { useSyncExternalStore } from 'react'
import { Workbox } from 'workbox-window'

/**
 * The app shell's service worker: registration, updates, and the install prompt
 * (INVENTORY_OFFLINE_AND_CHARACTER_PLAN.md, A1).
 *
 * <h2>Who gets a service worker</h2>
 * Only someone who has opened the signed-in workspace. `AppLayout` calls
 * `startServiceWorker({ install: true })`; the storefront calls it with `install: false`, which
 * only re-attaches to a worker this browser already has. An anonymous visitor browsing the
 * catalog never installs one, so never downloads the workspace's precache.
 *
 * <h2>Updates never land under someone mid-entry</h2>
 * A new deploy installs in the background and then WAITS. The page shows "A new version is
 * ready" and swaps only when the user taps Reload. An automatic swap would reload the page, and a
 * reload in the middle of a stock-in throws the half-typed delivery away.
 *
 * A module-level store rather than a provider, like `useServerNotifications`: the worker is one
 * per origin, the prompt is rendered from two different layouts, and the install prompt event can
 * fire before React has mounted anything.
 */

/** Chromium's install prompt event. Not in lib.dom, because it is not standardised. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface ServiceWorkerState {
  /** A new version has installed and is waiting for the user to reload into it. */
  updateReady: boolean
  /** The first install just finished: this device can now open the app without a connection. */
  offlineReady: boolean
  /** The browser will show its own install dialog if asked (Android Chrome, desktop Chromium). */
  canInstall: boolean
}

let state: ServiceWorkerState = { updateReady: false, offlineReady: false, canInstall: false }
const listeners = new Set<() => void>()

function setState(patch: Partial<ServiceWorkerState>): void {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useServiceWorkerState(): ServiceWorkerState {
  return useSyncExternalStore(subscribe, () => state, () => state)
}

// ------------------------------------------------------------------------------- registration

/** How often a visible page asks whether a new version has been deployed. */
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000

let workbox: Workbox | null = null
let attaching = false
let reloadRequested = false
let lastUpdateCheck = 0

function serviceWorkersAvailable(): boolean {
  // Dev serves no sw.js, so registering would only log a 404 on every load.
  return import.meta.env.PROD && 'serviceWorker' in navigator
}

/**
 * @param install `true` from the workspace: register, installing the worker if this browser has
 *   none. `false` from the storefront: only pick up a worker that already exists, so its update
 *   prompt still reaches someone who signed in once and now only browses the shop.
 */
export function startServiceWorker({ install }: { install: boolean }): void {
  if (!serviceWorkersAvailable() || workbox || attaching) return
  if (install) {
    attach()
    return
  }
  attaching = true
  void navigator.serviceWorker
    .getRegistration()
    .then((registration) => {
      attaching = false
      if (registration) attach()
    })
    .catch(() => {
      attaching = false
    })
}

function attach(): void {
  if (workbox) return
  const wb = new Workbox('/sw.js', { scope: '/' })
  workbox = wb

  // Fires for a version installed in the background, and also on load when one was already
  // waiting from an earlier visit.
  wb.addEventListener('waiting', () => setState({ updateReady: true }))

  wb.addEventListener('activated', (event) => {
    if (!event.isUpdate) setState({ offlineReady: true })
  })

  // `clientsClaim` makes the very first install take control too; only reload for an update the
  // user asked for, never for that.
  wb.addEventListener('controlling', () => {
    if (reloadRequested) window.location.reload()
  })

  void wb.register().then(() => {
    lastUpdateCheck = Date.now()
    requestPersistentStorage()
  })

  document.addEventListener('visibilitychange', checkForUpdateIfDue)
  window.setInterval(checkForUpdateIfDue, UPDATE_CHECK_INTERVAL_MS)
}

function checkForUpdateIfDue(): void {
  if (!workbox || document.visibilityState !== 'visible' || !navigator.onLine) return
  if (Date.now() - lastUpdateCheck < UPDATE_CHECK_INTERVAL_MS) return
  lastUpdateCheck = Date.now()
  void workbox.update().catch(() => {
    // Offline or a flaky network. The next visible tick tries again.
  })
}

/** Switches to the waiting version. The page reloads itself once the new version takes over. */
export function applyUpdate(): void {
  if (!workbox) return
  reloadRequested = true
  workbox.messageSkipWaiting()
}

/** Hides the prompt until the next update or the next load. The new version still waits. */
export function dismissUpdate(): void {
  setState({ updateReady: false })
}

export function acknowledgeOfflineReady(): void {
  setState({ offlineReady: false })
}

/**
 * Asks the browser not to clear this site's storage under pressure. Chromium grants it silently
 * to an installed or regularly used app; Safari ignores it. Either way the answer changes nothing
 * the user sees today. It matters once the catalog and unsent stock movements live on the device
 * (A2-A4), where eviction would mean losing work.
 */
let persistRequested = false
function requestPersistentStorage(): void {
  if (persistRequested) return
  persistRequested = true
  void navigator.storage?.persist?.().catch(() => undefined)
}

// --------------------------------------------------------------------------------- install

let installPrompt: BeforeInstallPromptEvent | null = null

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Hold the browser's own mini-infobar back: "Install Procure Paddy" in the account menu says
    // what it does, where the generic banner would interrupt whatever the user was doing.
    event.preventDefault()
    installPrompt = event as BeforeInstallPromptEvent
    setState({ canInstall: true })
  })
  window.addEventListener('appinstalled', () => {
    installPrompt = null
    setState({ canInstall: false })
  })
}

/** Shows the browser's install dialog. Each prompt event can be used once. */
export async function promptInstall(): Promise<void> {
  const prompt = installPrompt
  if (!prompt) return
  installPrompt = null
  setState({ canInstall: false })
  await prompt.prompt()
}

// ------------------------------------------------------------------------- platform detection

/** Running from the home screen rather than a browser tab. */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/**
 * iPhone or iPad Safari. iPadOS reports itself as a Mac, so a touch-capable "Mac" counts too.
 * Other iOS browsers can't add to the home screen the same way, but they share Safari's engine
 * and the same Share-sheet instruction works in recent versions of each.
 */
export function isIos(): boolean {
  const ua = navigator.userAgent
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
}
