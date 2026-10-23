import { api } from '@/api/client'
import type { ChangesPage, SnapshotPage } from '@/features/catalog/types'

/** Rows per request: big enough that 100k products is ~50 round trips, small enough to stay quick on 3G. */
export const SYNC_PAGE_SIZE = 2000

/**
 * What this phone has waiting to send, said on every change-feed request (V55,
 * MULTI_BRANCH_UX_PLAN.md §5.8 "Phones") so the owner's branch table knows a branch's figure is behind.
 * Set by the outbox; until then nothing is said. A registry rather than an import, because the outbox
 * already imports the catalogue.
 */
let phoneStatus: () => Record<string, string | number> = () => ({})

export function reportPhoneStatusWith(source: () => Record<string, string | number>): void {
  phoneStatus = source
}

export const catalogApi = {
  snapshot: (afterId: string | null) =>
    api
      .get<SnapshotPage>('/api/products/sync/snapshot', {
        params: { limit: SYNC_PAGE_SIZE, ...(afterId ? { afterId } : {}) },
      })
      .then((r) => r.data),

  changes: (cursor: string) =>
    api
      .get<ChangesPage>('/api/products/sync/changes', { params: { cursor, limit: SYNC_PAGE_SIZE, ...phoneStatus() } })
      .then((r) => r.data),
}
