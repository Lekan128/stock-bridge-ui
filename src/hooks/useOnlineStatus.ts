import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/**
 * Whether the device says it has a network. Trust it when it says *offline* — that is reliable.
 * When it says online it only means some interface is up, not that the API answers; requests that
 * get no answer report that themselves (`AppError.kind`).
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )
}

/**
 * Whether a background poll should bother firing right now. A poll from a hidden tab or a phone
 * with no signal costs battery and data and can only fail; the caller re-polls when the page is
 * visible and online again (see {@link onPollingResumable}).
 */
export function canPollNow(): boolean {
  return navigator.onLine && document.visibilityState === 'visible'
}

/** Calls `handler` whenever polling becomes worthwhile again: back online, or the tab shown. */
export function onPollingResumable(handler: () => void): () => void {
  const onVisible = () => {
    if (canPollNow()) handler()
  }
  window.addEventListener('online', onVisible)
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    window.removeEventListener('online', onVisible)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
