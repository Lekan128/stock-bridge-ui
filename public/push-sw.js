/*
 * Notifications (STOCK_AREAS_PART_5.md; owner, 2026-11-01: "you get a notification … and if it has been moved it
 * goes away"). Loaded into the app's service worker (vite.config.ts, workbox.importScripts), so it runs with the
 * app closed. The server sends { title, body, tag, url, quiet }: one tag per request, so "Moved ✓" lands in the
 * place of "The Kitchen asked for 2 items"; a quiet one shows without a sound and closes itself after a moment.
 */
const QUIET_FOR_MS = 4000

self.addEventListener('push', (event) => {
  let message = {}
  try {
    message = event.data ? event.data.json() : {}
  } catch {
    message = {}
  }
  const options = {
    body: message.body || '',
    tag: message.tag || undefined,
    data: { url: message.url || '/app' },
    icon: '/icons/pwa-192.png',
    silent: message.quiet === true,
    renotify: false,
  }
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(message.title || 'Procurepaddy', options)
      if (message.quiet && message.tag) {
        await new Promise((resolve) => setTimeout(resolve, QUIET_FOR_MS))
        const shown = await self.registration.getNotifications({ tag: message.tag })
        shown.forEach((notification) => notification.close())
      }
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || '/app', self.location.origin)
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows.find((client) => new URL(client.url).pathname.startsWith('/app'))
      if (open) {
        // Opened over whatever page they're on, in the app itself: a reload would lose a half-typed entry.
        await open.focus()
        open.postMessage({ type: 'pp.push.open', url: url.pathname + url.search })
        return
      }
      await self.clients.openWindow(url.href)
    })(),
  )
})
