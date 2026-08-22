import { api } from '@/api/client'
import type { VendorRangeParams, VendorStatement } from '@/features/vendor/types'

/**
 * The seller's own account statement.
 *
 * Behind the same three server-side gates as `vendorSalesApi`: either analytics permission,
 * a seller check on the caller's company, and a `seller_client_id` predicate on every query.
 * Note what is NOT in either signature below — a seller id. The server takes it from the
 * authenticated caller and refuses to read one from the query string, so there is no
 * parameter here that could be pointed at somebody else's money.
 *
 * A 403 means the caller is signed in as a company that does not sell. The route is already
 * behind `RequireSeller`, so it should be unreachable from the UI.
 */
const BASE = '/api/vendor/statement'

export const vendorStatementApi = {
  statement: (params: VendorRangeParams) =>
    api.get<VendorStatement>(BASE, { params }).then((r) => r.data),

  /**
   * The CSV export, fetched as a blob rather than linked to directly.
   *
   * A plain `<a href>` cannot carry the bearer token — the API is on a different origin and
   * there is no cookie session — so the download has to go through the same axios client as
   * everything else, and the caller turns the blob into a save. That also means a 401 gets
   * the shared refresh-and-retry treatment instead of surfacing as a broken file.
   */
  exportCsv: (params: VendorRangeParams) =>
    api.get(`${BASE}/export`, { params, responseType: 'blob' }).then((r) => r.data as Blob),
}
