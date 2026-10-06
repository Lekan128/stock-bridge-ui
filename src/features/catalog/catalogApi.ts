import { api } from '@/api/client'
import type { ChangesPage, SnapshotPage } from '@/features/catalog/types'

/** Rows per request: big enough that 100k products is ~50 round trips, small enough to stay quick on 3G. */
export const SYNC_PAGE_SIZE = 2000

export const catalogApi = {
  snapshot: (afterId: string | null) =>
    api
      .get<SnapshotPage>('/api/products/sync/snapshot', {
        params: { limit: SYNC_PAGE_SIZE, ...(afterId ? { afterId } : {}) },
      })
      .then((r) => r.data),

  changes: (cursor: string) =>
    api
      .get<ChangesPage>('/api/products/sync/changes', { params: { cursor, limit: SYNC_PAGE_SIZE } })
      .then((r) => r.data),
}
