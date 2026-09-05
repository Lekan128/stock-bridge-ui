import type { AxiosProgressEvent } from 'axios'
import { api } from '@/api/client'
import type {
  CommitPreview,
  ImportCellValue,
  ImportKind,
  ImportMode,
  ImportResult,
  ImportRow,
  ImportRowFilterStatus,
  ImportSession,
  ImportSessionSummary,
  Page,
  StockInFilter,
  UndoBlockedResponse,
  ValueMappingRequest,
} from '@/features/imports/types'
import type { AppError } from '@/types/api'
import { downloadBlob } from '@/utils/downloadBlob'

const BASE = '/api/imports'


/**
 * Everything the import screens ask of a server, in the shape both the real client and M3's
 * mock satisfy. The URL-returning and download helpers are deliberately outside it: they have
 * no mock equivalent and always go to the real API.
 */
interface ImportsBackend {
  create(
    file: File,
    kind: ImportKind,
    mode: ImportMode,
    onProgress?: (pct: number) => void,
  ): Promise<ImportSession>
  get(id: string): Promise<ImportSession>
  rows(
    id: string,
    params: { status?: ImportRowFilterStatus; page?: number; size?: number },
  ): Promise<Page<ImportRow>>
  patchRow(id: string, rowId: string, normalized: Record<string, ImportCellValue>): Promise<ImportRow>
  /** MULTI_PACK_PER_VENDOR_DESIGN.md §6a's one-click "Confirm" on a candidate pack. */
  confirmPack(id: string, rowId: string, packagingUnit: string, packagingSize: number): Promise<ImportRow>
  skipRow(id: string, rowId: string, skipped: boolean): Promise<ImportRow>
  patchMapping(id: string, columnMapping: Record<string, string | null>): Promise<ImportSession>
  resolveValue(id: string, body: ValueMappingRequest): Promise<ImportSession>
  preview(id: string): Promise<CommitPreview>
  commit(id: string): Promise<ImportResult>
  result(id: string): Promise<ImportResult>
  undo(id: string): Promise<ImportResult>
  discard(id: string): Promise<void>
  list(params: { kind?: ImportKind; page?: number; size?: number }): Promise<Page<ImportSessionSummary>>
}

// ------------------------------------------------------------------ commit

/**
 * How long to keep asking whether an async commit has finished, and how fast.
 *
 * A 5,000-row commit is one transaction over the row cap, so the ceiling is generous: giving up
 * at thirty seconds and telling someone their import failed when it is still running would be a
 * lie, and a damaging one — they would re-run it. The interval eases off so a long wait does not
 * turn into hundreds of requests.
 */
const COMMIT_POLL_FIRST_MS = 1200
const COMMIT_POLL_MAX_INTERVAL_MS = 5000
const COMMIT_POLL_DEADLINE_MS = 5 * 60 * 1000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function appError(status: number, message: string): AppError {
  return { status, message }
}

function progressPercent(event: AxiosProgressEvent): number | null {
  if (!event.total) return null
  return Math.min(100, Math.round((event.loaded * 100) / event.total))
}

/**
 * The 202 branch of `commit` (contract §6: anything over ASYNC_ROW_THRESHOLD rows).
 *
 * 202 carries no result — there is nothing to report yet — so the only honest thing to return is
 * the one the server eventually writes. Poll the record until its status leaves COMMITTING, then
 * read the result from its own endpoint, which is the same one a refresh of the result screen
 * uses. Callers therefore cannot tell 200 from 202 apart, which is the point: M3's confirm screen
 * awaits one promise and navigates.
 */
async function awaitAsyncCommit(id: string): Promise<ImportResult> {
  const deadline = Date.now() + COMMIT_POLL_DEADLINE_MS
  let interval = COMMIT_POLL_FIRST_MS

  for (;;) {
    await sleep(interval)
    const session = await realBackend.get(id)

    if (session.status === 'COMMITTED') return realBackend.result(id)

    if (session.status === 'FAILED' || session.status === 'EXPIRED') {
      // A run that failed part-way still has a result to show — which rows went in and which
      // did not is exactly what the user needs. Only when there is genuinely nothing to read
      // do we surface a failure.
      return realBackend.result(id).catch(() => {
        throw appError(500, 'This import could not be completed. Nothing was changed.')
      })
    }

    if (Date.now() >= deadline) {
      throw appError(
        0,
        'This import is taking longer than expected. It is still running — open it again from your recent imports in a few minutes to see how it went.',
      )
    }

    interval = Math.min(Math.round(interval * 1.5), COMMIT_POLL_MAX_INTERVAL_MS)
  }
}

// -------------------------------------------------------------------- undo

/** True when a 409 body is the contract §4 `UndoBlockedResponse` and not a plain `ApiError`. */
function asUndoBlocked(body: unknown): UndoBlockedResponse | null {
  if (typeof body !== 'object' || body === null) return null
  const candidate = body as { message?: unknown; blockers?: unknown }
  if (typeof candidate.message !== 'string' || !Array.isArray(candidate.blockers)) return null
  return { message: candidate.message, blockers: candidate.blockers as UndoBlockedResponse['blockers'] }
}

// ------------------------------------------------------------- real client

const realBackend: ImportsBackend = {
  create(file, kind, mode, onProgress) {
    const form = new FormData()
    form.append('file', file)
    form.append('kind', kind)
    form.append('mode', mode)
    onProgress?.(0)
    // The Content-Type header is deliberately not set: the browser has to write it itself so it
    // carries the multipart boundary. Setting it by hand is how multipart uploads silently 400.
    return api
      .post<ImportSession>(BASE, form, {
        onUploadProgress: (event) => {
          const pct = progressPercent(event)
          if (pct !== null) onProgress?.(pct)
        },
      })
      .then((response) => {
        onProgress?.(100)
        return response.data
      })
  },

  get(id) {
    return api.get<ImportSession>(`${BASE}/${id}`).then((r) => r.data)
  },

  rows(id, params) {
    return api
      .get<Page<ImportRow>>(`${BASE}/${id}/rows`, {
        params: { status: params.status, page: params.page, size: params.size },
      })
      .then((r) => r.data)
  },

  patchRow(id, rowId, normalized) {
    return api.patch<ImportRow>(`${BASE}/${id}/rows/${rowId}`, { normalized }).then((r) => r.data)
  },

  confirmPack(id, rowId, packagingUnit, packagingSize) {
    return api
      .post<ImportRow>(`${BASE}/${id}/rows/${rowId}/confirm-pack`, { packagingUnit, packagingSize })
      .then((r) => r.data)
  },

  skipRow(id, rowId, skipped) {
    return api.patch<ImportRow>(`${BASE}/${id}/rows/${rowId}/skip`, { skipped }).then((r) => r.data)
  },

  patchMapping(id, columnMapping) {
    return api.patch<ImportSession>(`${BASE}/${id}/mapping`, { columnMapping }).then((r) => r.data)
  },

  resolveValue(id, body) {
    return api.patch<ImportSession>(`${BASE}/${id}/value-mappings`, body).then((r) => r.data)
  },

  preview(id) {
    return api.get<CommitPreview>(`${BASE}/${id}/preview`).then((r) => r.data)
  },

  async commit(id) {
    const response = await api.post<ImportResult>(`${BASE}/${id}/commit`)
    // 200 is the finished result; 202 means it is running and the result has to be waited for.
    return response.status === 202 ? awaitAsyncCommit(id) : response.data
  },

  result(id) {
    return api.get<ImportResult>(`${BASE}/${id}/result`).then((r) => r.data)
  },

  async undo(id) {
    // 409 is not an error here — it is `UndoBlockedResponse`, the body `UndoBlockedPanel` was
    // built to render. Left to the shared response interceptor it would be flattened to
    // `{status, message}` and the blockers (which row, which product, why) would be lost, so
    // the request opts 409 into the success path and re-throws it in one piece.
    const response = await api.post<ImportResult | UndoBlockedResponse>(`${BASE}/${id}/undo`, undefined, {
      validateStatus: (status) => status === 200 || status === 409,
    })

    if (response.status !== 409) return response.data as ImportResult

    const blocked = asUndoBlocked(response.data)
    if (!blocked) throw appError(409, 'This import can no longer be undone.')

    const error: AppError & { undoBlocked: UndoBlockedResponse } = {
      status: 409,
      message: blocked.message,
      undoBlocked: blocked,
    }
    throw error
  },

  discard(id) {
    return api.delete<void>(`${BASE}/${id}`).then(() => undefined)
  },

  list(params) {
    return api
      .get<Page<ImportSessionSummary>>(BASE, {
        params: { kind: params.kind, page: params.page, size: params.size },
      })
      .then((r) => r.data)
  },
}

const backend: ImportsBackend = realBackend

// ------------------------------------------------------- binary downloads

/**
 * Every spreadsheet this feature hands back is behind the bearer token, and a bearer token lives
 * in memory — never in a cookie. A plain `<a href="/api/…" download>` therefore sends no
 * credentials at all and answers 401, and on the dev server it would not even reach the API.
 * Fetching through the authed instance and handing the browser an object URL is the only way
 * these links can work, which is why they are `Promise<void>` actions rather than hrefs.
 */
async function download(path: string, filename: string, params?: Record<string, string>): Promise<void> {
  const response = await api.get(path, { responseType: 'blob', params })
  downloadBlob(response.data as Blob, filename)
}

function absoluteUrl(path: string): string {
  return `${api.defaults.baseURL ?? ''}${path}`
}

function stockInTemplateQuery(params: {
  productIds?: string[]
  filter?: StockInFilter
}): Record<string, string> {
  const query: Record<string, string> = {}
  // `productIds` wins over `filter` when present (contract §3), so it is never sent alongside.
  if (params.productIds?.length) query.productIds = params.productIds.join(',')
  else if (params.filter) query.filter = params.filter
  return query
}

/**
 * The one seam between the import screens and the server.
 *
 * Signatures are frozen by `BULK_IMPORT_CONTRACT.md` §7 and every path below is quoted from its
 * §3 table. No component imports anything from `api/` except this object.
 *
 * <h2>There is no mock behind this any more, deliberately</h2>
 * §7 originally required an in-memory `mockAdapter` here, because the screens were built in
 * parallel with the server that serves them and had to run against something. That reason
 * expired the moment the backend shipped, and the fixtures then cost more than they returned: a
 * dev server left running with `VITE_IMPORTS_MOCK=true` served a hardcoded "All 38 rows look
 * good." for a four-row file and committed nothing, and nothing on screen said so. A screen
 * asserting something the system never did is the exact defect the unit/pack/price remediation
 * existed to remove, so the fixtures went with it. Develop against the real API.
 */
export const importsApi = {
  /** POST /api/imports (multipart: file, kind, mode) */
  create(
    file: File,
    kind: ImportKind,
    mode: ImportMode,
    onProgress?: (pct: number) => void,
  ): Promise<ImportSession> {
    return backend.create(file, kind, mode, onProgress)
  },

  /** GET /api/imports/{id} */
  get(id: string): Promise<ImportSession> {
    return backend.get(id)
  },

  /** GET /api/imports/{id}/rows?status=&page=&size= — `status` may be the ISSUES pseudo-filter. */
  rows(
    id: string,
    params: { status?: ImportRowFilterStatus; page?: number; size?: number },
  ): Promise<Page<ImportRow>> {
    return backend.rows(id, params)
  },

  /** PATCH /api/imports/{id}/rows/{rowId} — returns the revalidated row, never a refetch. */
  patchRow(id: string, rowId: string, normalized: Record<string, unknown>): Promise<ImportRow> {
    return backend.patchRow(id, rowId, normalized as Record<string, ImportCellValue>)
  },

  /** POST /api/imports/{id}/rows/{rowId}/confirm-pack — MULTI_PACK_PER_VENDOR_DESIGN.md §6a's
   *  one-click "Confirm" on a candidate pack; creates it and returns the revalidated row. */
  confirmPack(id: string, rowId: string, packagingUnit: string, packagingSize: number): Promise<ImportRow> {
    return backend.confirmPack(id, rowId, packagingUnit, packagingSize)
  },

  /** PATCH /api/imports/{id}/rows/{rowId}/skip */
  skipRow(id: string, rowId: string, skipped: boolean): Promise<ImportRow> {
    return backend.skipRow(id, rowId, skipped)
  },

  /** PATCH /api/imports/{id}/mapping — revalidates every row. */
  patchMapping(id: string, columnMapping: Record<string, string | null>): Promise<ImportSession> {
    return backend.patchMapping(id, columnMapping)
  },

  /** PATCH /api/imports/{id}/value-mappings — one decision, every matching row revalidated. */
  resolveValue(id: string, body: ValueMappingRequest): Promise<ImportSession> {
    return backend.resolveValue(id, body)
  },

  /** GET /api/imports/{id}/preview */
  preview(id: string): Promise<CommitPreview> {
    return backend.preview(id)
  },

  /** POST /api/imports/{id}/commit — 200 answers directly, 202 is polled to completion. */
  commit(id: string): Promise<ImportResult> {
    return backend.commit(id)
  },

  /** POST /api/imports/{id}/undo — rejects with an `UndoBlockedError` on 409. */
  undo(id: string): Promise<ImportResult> {
    return backend.undo(id)
  },

  /** DELETE /api/imports/{id} */
  discard(id: string): Promise<void> {
    return backend.discard(id)
  },

  /** GET /api/imports?kind=&page=&size= */
  list(params: { kind?: ImportKind; page?: number; size?: number }): Promise<Page<ImportSessionSummary>> {
    return backend.list(params)
  },

  /**
   * GET /api/imports/{id}/report — the absolute URL, for reference only.
   *
   * NOT usable as an `<a href>`: the endpoint is authenticated and the token is in memory. Use
   * `downloadReport` instead, which is what the result screen calls.
   */
  reportUrl(id: string): string {
    return absoluteUrl(`${BASE}/${id}/report`)
  },

  /** GET /api/imports/templates/products — see the note on `reportUrl`. */
  productTemplateUrl(): string {
    return absoluteUrl(`${BASE}/templates/products`)
  },

  /** GET /api/imports/templates/stock-in?productIds=&filter= — see the note on `reportUrl`. */
  stockInTemplateUrl(params: { productIds?: string[]; filter?: StockInFilter }): string {
    const query = new URLSearchParams(stockInTemplateQuery(params)).toString()
    return absoluteUrl(`${BASE}/templates/stock-in${query ? `?${query}` : ''}`)
  },

  /** GET /api/imports/{id}/report, fetched with the bearer token and saved. */
  downloadReport(id: string): Promise<void> {
    return download(`${BASE}/${id}/report`, 'import-report.xlsx')
  },

  /** GET /api/imports/templates/products, fetched with the bearer token and saved. */
  downloadProductTemplate(): Promise<void> {
    return download(`${BASE}/templates/products`, 'product-import-template.xlsx')
  },

  /** GET /api/imports/templates/stock-in, fetched with the bearer token and saved. */
  downloadStockInTemplate(params: { productIds?: string[]; filter?: StockInFilter }): Promise<void> {
    return download(`${BASE}/templates/stock-in`, 'stock-sheet.xlsx', stockInTemplateQuery(params))
  },

  /**
   * GET /api/imports/{id}/result — 404 until the import has actually run.
   *
   * Separate from `commit`'s return value because the result screen is a real URL that has to
   * survive a refresh and a shared link, and `commit` only ever answers once.
   */
  result(id: string): Promise<ImportResult> {
    return backend.result(id)
  },
}

/** 409 body from `undo` (contract §4 UndoBlockedResponse), carried on the thrown error. */
export function undoBlockedFrom(error: unknown): UndoBlockedResponse | null {
  if (typeof error !== 'object' || error === null) return null
  const candidate = (error as { undoBlocked?: unknown }).undoBlocked
  if (
    typeof candidate === 'object' &&
    candidate !== null &&
    'message' in candidate &&
    'blockers' in candidate
  ) {
    return candidate as UndoBlockedResponse
  }
  return null
}
