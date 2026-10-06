import { queryKeys } from '@/data/queryKeys'
import { useApiQuery } from '@/data/useApiQuery'
import { expectedApi } from '@/features/expected/api/expectedApi'
import { expectedCopy } from '@/features/expected/copy'
import type { ExpectedDelivery } from '@/features/expected/types'

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
  const result = useApiQuery<ExpectedDelivery>({
    queryKey: queryKeys.expected.detail(id),
    queryFn: () => expectedApi.get(id as string),
    fallbackError: expectedCopy.receive.loadFailed,
    enabled: id != null,
  })

  return { expected: result.data ?? null, loading: result.loading, error: result.error }
}
