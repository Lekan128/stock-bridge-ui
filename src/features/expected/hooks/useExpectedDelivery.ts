import { useEffect, useState } from 'react'
import { expectedApi } from '@/features/expected/api/expectedApi'
import { expectedCopy } from '@/features/expected/copy'
import type { ExpectedDelivery } from '@/features/expected/types'
import { isAppError } from '@/types/api'

/**
 * One expected delivery, or nothing at all when `id` is absent.
 *
 * `id` is optional because the one screen that uses this — Record a delivery — is reached both
 * ways: with `?expected=…` from the list, and on its own from the products page. With no id it
 * must ask for nothing, report nothing and leave that page exactly as it was.
 *
 * A failure is reported rather than swallowed, but it is not fatal: the delivery screen says the
 * order could not be loaded and stays usable, because somebody standing at a gate with a lorry in
 * front of them still has stock to record.
 */
export function useExpectedDelivery(id: string | null) {
  const [expected, setExpected] = useState<ExpectedDelivery | null>(null)
  const [loading, setLoading] = useState(id != null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (id == null) {
      setExpected(null)
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)

    expectedApi
      .get(id)
      .then((response) => {
        if (!cancelled) setExpected(response)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(isAppError(err) ? err.message : expectedCopy.receive.loadFailed)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  return { expected, loading, error }
}
