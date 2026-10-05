import { useCallback } from 'react'
import { queryKeys } from '@/data/queryKeys'
import { useApiQuery } from '@/data/useApiQuery'
import { expectedApi } from '@/features/expected/api/expectedApi'
import { expectedCopy } from '@/features/expected/copy'
import type { ExpectedDelivery, ExpectedDeliveryStatus, PageResponse } from '@/features/expected/types'

/**
 * One page of expected deliveries, newest first.
 *
 * `status` left undefined lists every status — the "All" tab. The list screen asks for OPEN,
 * because the question this feature exists to answer is "what have we got coming?" and a page
 * whose first screenful is last quarter's finished orders does not answer it.
 */
export function useExpectedDeliveries(
  status: ExpectedDeliveryStatus | undefined,
  page: number,
  size: number,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const result = useApiQuery<PageResponse<ExpectedDelivery>>({
    queryKey: queryKeys.expected.list(status, page, size),
    queryFn: () => expectedApi.list({ status, page, size }),
    fallbackError: expectedCopy.list.loadFailed,
    keepPrevious: true,
    enabled,
  })
  const { setData } = result

  const replace = useCallback(
    (updated: ExpectedDelivery) => {
      setData((current) =>
        current == null
          ? current
          : { ...current, content: current.content.map((entry) => (entry.id === updated.id ? updated : entry)) },
      )
    },
    [setData],
  )

  return { data: result.data ?? null, loading: result.loading, error: result.error, refetch: result.refetch, replace }
}
