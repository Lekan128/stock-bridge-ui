import { useEffect, useRef } from 'react'

/**
 * Runs `onReceived` when a notification whose tag starts with `prefix` reaches this device while the page is open
 * (public/push-sw.js posts it): an open Tickets screen catches up at once instead of at its next check.
 */
export function usePushReceived(prefix: string, onReceived: () => void): void {
  const latest = useRef(onReceived)
  useEffect(() => {
    latest.current = onReceived
  })
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const listen = (event: MessageEvent) => {
      const data = event.data as { type?: string; tag?: string } | undefined
      if (data?.type === 'pp.push.received' && (data.tag ?? '').startsWith(prefix)) latest.current()
    }
    navigator.serviceWorker.addEventListener('message', listen)
    return () => navigator.serviceWorker.removeEventListener('message', listen)
  }, [prefix])
}
