/**
 * Wire types for the bulk import pipeline.
 *
 * Hand-mirrored from `BULK_IMPORT_CONTRACT.md` §4 (response DTOs) and §1 (enum spellings).
 * Field names here are the exact JSON keys the backend sends — do not rename them to something
 * that reads better in a component; rename it at the render site instead.
 *
 * Enums are string-literal unions, never numeric (contract §1).
 *
 * ## `T | null` on the wire means "absent", not `null`
 *
 * The API sets `spring.jackson.default-property-inclusion: non_null` globally, so a field whose
 * value is null is **left out of the JSON entirely** rather than sent as `"field": null`. Every
 * `| null` below therefore arrives as `undefined` at runtime, and `x === null` is false for all
 * of them.
 *
 * The types are still written `| null` because that is what the contract §4 documents and what
 * the mock adapter produces — but any check against one of these fields must be nullish
 * (`== null`, `?? `, `!x`) and never `=== null`. This is not theoretical: four screens shipped
 * with `=== null`/`!== null` on `resolution` and `continuationOf`, passed against the mock's
 * real nulls, and inverted the moment they met the server.
 */

// ---------------------------------------------------------------- §1 enums

export type ImportKind = 'PRODUCT_CATALOG' | 'STOCK_IN'

export type ImportMode = 'CREATE_ONLY' | 'CREATE_OR_UPDATE' | 'UPDATE_ONLY'

export type ImportStatus =
  | 'PARSING'
  | 'NEEDS_REVIEW'
  | 'READY'
  | 'COMMITTING'
  | 'COMMITTED'
  | 'FAILED'
  | 'EXPIRED'

export type ImportRowStatus = 'VALID' | 'ERROR' | 'WARNING' | 'SKIPPED' | 'COMMITTED'

/**
 * What `GET /rows?status=` accepts (contract §3). `ISSUES` is a server-side pseudo-filter
 * meaning ERROR+WARNING in one correctly-paged response — it exists because the review screen
 * defaults to the "Issues" view, and a warning hidden behind that filter would be exactly the
 * silent drop §8.8 forbids. The frontend must not merge two requests to fake it.
 */
export type ImportRowFilterStatus = ImportRowStatus | 'ISSUES' | 'ALL'

/** `filter` on the pre-filled stock-in template endpoint (contract §3). */
export type StockInFilter = 'ALL' | 'LOW_STOCK' | 'BY_VENDOR' | 'BY_CATEGORY'

// ------------------------------------------------- §4 ImportFieldDescriptor

export type ImportFieldType =
  | 'TEXT'
  | 'NUMBER'
  | 'INTEGER'
  | 'MONEY'
  | 'BOOLEAN'
  | 'DATE'
  | 'ENUM'
  | 'REFERENCE'

export interface ImportFieldOption {
  value: string
  label: string
}

export interface ImportFieldDescriptor {
  /** snake_case, identical to the template column header (contract §5). */
  key: string
  label: string
  type: ImportFieldType
  required: boolean
  /** Reference columns on the stock-in sheet (`sku`, `product_name`). */
  readOnly: boolean
  /** True for stock-in `quantity` — the one column the user actually fills. */
  primaryInput: boolean
  helpText: string | null
  /** ENUM only, else null. */
  options: ImportFieldOption[] | null
}

// ------------------------------------------------------ §4 ImportRowResponse

export interface ImportRowIssue {
  /** A field key — never rendered to the user as-is (contract §8.7). */
  column: string
  message: string
}

export interface ImportRowError extends ImportRowIssue {
  suggestion: ImportFieldOption | null
  /**
   * Rows sharing the same `(column, raw value, message)`. Powers `[Fix all 12 "KGS" rows]`.
   * Non-null on every error that has one, so the frontend never computes it (contract §4).
   */
  bulkFixCount: number | null
}

export type ImportRowWarning = ImportRowIssue

export type ImportCellValue = string | number | boolean | null

export type ImportRowOutcome = 'CREATED' | 'UPDATED' | 'SKIPPED' | 'FAILED'

export interface ImportRow {
  id: string
  /** 1-based, matching what the user sees in their spreadsheet. */
  excelRow: number
  status: ImportRowStatus
  /** Exactly what the cells contained. Never rewritten. */
  raw: Record<string, ImportCellValue>
  /** Post-parse, post-repair values. What commit reads. */
  normalized: Record<string, ImportCellValue>
  errors: ImportRowError[]
  warnings: ImportRowWarning[]
  resolvedEntityId: string | null
  /** The human-readable name behind `resolvedEntityId` — render this, never the id. */
  resolvedEntityLabel: string | null
  /** `excelRow` of the parent row for a §7.1 continuation row. */
  continuationOf: number | null
  outcome: ImportRowOutcome | null
}

// -------------------------------------------------------- §4 UnresolvedValue

export type UnresolvedValueKind = 'VENDOR' | 'UNIT' | 'PRODUCT'

export interface UnresolvedValueSuggestion {
  id: string
  label: string
  hint: string | null
  score: number
}

export type ValueResolution =
  | { kind: 'EXISTING'; id: string }
  | { kind: 'CREATE_NEW'; payload: Record<string, ImportCellValue> }
  | { kind: 'LITERAL'; value: string }
  | { kind: 'BLANK' }
  | { kind: 'SKIP_ROWS' }

export interface UnresolvedValue {
  column: string
  columnLabel: string
  value: string
  rowCount: number
  excelRows: number[]
  kind: UnresolvedValueKind
  suggestions: UnresolvedValueSuggestion[]
  allowCreateNew: boolean
  allowBlank: boolean
  allowSkipRows: boolean
  /** The accepted choice once answered. */
  resolution: ValueResolution | null
}

export interface ValueMappingRequest {
  column: string
  from: string
  to: ValueResolution
}

// -------------------------------------------------- §4 ImportSessionResponse

export interface ImportSession {
  id: string
  kind: ImportKind
  mode: ImportMode
  status: ImportStatus
  originalFilename: string
  rowCount: number
  validCount: number
  errorCount: number
  warningCount: number
  skippedCount: number
  needsMapping: boolean
  /** resolved header → field key. Identity map for our own template. */
  columnMapping: Record<string, string | null>
  unmappedHeaders: string[]
  /** Field keys, resolved to labels before display (contract §8.7). */
  requiredFieldsMissing: string[]
  /** Lets the grid render without hardcoding a column list. */
  fields: ImportFieldDescriptor[]
  unresolvedValues: UnresolvedValue[]
  uploadedByName: string
  createdAt: string
  expiresAt: string
  committedAt: string | null
}

/**
 * Row of the recent-imports list. Pinned by contract §4 `ImportSessionSummaryResponse`.
 *
 * `summaryText` is composed server-side on purpose — the same rule the preview and result lines
 * follow, so the frontend never string-builds a count.
 */
export interface ImportSessionSummary {
  id: string
  kind: ImportKind
  status: ImportStatus
  originalFilename: string
  rowCount: number
  createdCount: number | null
  updatedCount: number | null
  /** "38 created, 4 updated". Null only while a server has nothing to say yet. */
  summaryText: string | null
  uploadedByName: string
  createdAt: string
  committedAt: string | null
  undoable: boolean
}

// ------------------------------------------------ §4 CommitPreview / Result

export interface CommitLine {
  key: string
  label: string
  count: number
  /** The sentence. Composed server-side — never string-built here (contract §4). */
  text: string
}

export interface CommitPreview {
  headline: string
  lines: CommitLine[]
  confirmLabel: string
  blocked: boolean
  blockedReason: string | null
}

export interface ImportResult {
  sessionId: string
  status: ImportStatus
  headline: string
  lines: CommitLine[]
  createdCount: number
  updatedCount: number
  skippedCount: number
  failedCount: number
  vendorsCreated: number
  productsCreated: number
  movementsCreated: number
  undoable: boolean
  undoBlockedReason: string | null
  reportUrl: string
  targetUrl: string
}

// -------------------------------------------------- §4 UndoBlockedResponse

export interface UndoBlocker {
  excelRow: number
  label: string
  reason: string
  /** Never rendered. Used only to build a link to the entity. */
  entityId: string
}

export interface UndoBlockedResponse {
  message: string
  blockers: UndoBlocker[]
}

// -------------------------------------------------------------- pagination

/** Spring Data's `Page<T>` on the wire, same shape products already uses. */
export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first: boolean
  last: boolean
}
