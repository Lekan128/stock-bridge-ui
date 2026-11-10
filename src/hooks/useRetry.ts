import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * How long "Trying…" stays at the least (owner, 2026-11-10: "even if it is an instant rejection, a user would still
 * like to see that it tried"). Long enough to be seen, short enough not to feel slow: Firefox's guidance holds a
 * spinner 400 ms, others ~700 ms; a retry someone pressed gets the longer one.
 */
export const MIN_TRYING_MS = 700

/**
 * A "Try again" that shows it tried: `trying` from the tap - at once, since it was asked for - until the attempt ends,
 * and never for less than {@link MIN_TRYING_MS}. `triedAt` is when the last attempt finished, so a screen still
 * showing the problem can say "Still can't reach it · tried 22:14".
 */
export function useRetry(onRetry: (() => unknown) | undefined) {
  const [trying, setTrying] = useState(false)
  const [triedAt, setTriedAt] = useState<number | null>(null)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const retry = useCallback(async () => {
    if (!onRetry || trying) return
    setTrying(true)
    await Promise.allSettled([
      Promise.resolve().then(onRetry),
      new Promise((resolve) => window.setTimeout(resolve, MIN_TRYING_MS)),
    ])
    if (!alive.current) return
    setTrying(false)
    setTriedAt(Date.now())
  }, [onRetry, trying])
  return { trying, triedAt, retry }
}
