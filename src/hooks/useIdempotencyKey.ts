import { useCallback, useRef } from 'react'

/**
 * One `Idempotency-Key` per intended write, for the API's stock endpoints.
 *
 * The case it exists for: a stock-in reaches the server and is recorded, the response is lost to
 * a dropped signal, the screen says "Couldn't reach Procure Paddy", and the user taps Confirm
 * again. Retried with the same key, the server answers with the stored result instead of
 * recording the delivery a second time.
 *
 * So the key must be the SAME across retries of the same entry, and DIFFERENT for a new entry.
 * `keyFor(payload)` gives exactly that: it reuses the last key while the payload is unchanged, and
 * mints a fresh one as soon as anything in it differs — which also keeps the server from refusing
 * an edited retry as "this key was used for a different request".
 */
export function useIdempotencyKey(): (payload: unknown) => string {
  const last = useRef<{ fingerprint: string; key: string } | null>(null)

  return useCallback((payload: unknown) => {
    const fingerprint = JSON.stringify(payload)
    if (last.current?.fingerprint !== fingerprint) {
      last.current = { fingerprint, key: crypto.randomUUID() }
    }
    return last.current.key
  }, [])
}
