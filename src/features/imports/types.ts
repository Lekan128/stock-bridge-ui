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
  /**
   * The field key this column states the unit of — `counted_in` qualifies stock-in's `quantity`.
   * Absent on every other column, on both sheets.
   *
   * `visibleFields` keeps a qualifier whenever its subject has data, which is the only thing
   * that puts it on screen: a unit column is optional, never `primaryInput`, and (since the
   * guessing warning it replaced was deleted) never flagged, so all three of the grid's other
   * reasons to show a column miss it. Without this the unit of a quantity was uncorrectable in
   * the UI on any sheet that did not already carry the column.
   *
   * <h2>The catalog sheet no longer has one</h2>
   * It used to: `opening_stock_counted_in` qualified `opening_stock` and asked which unit the
   * number beside it was in. `UNIT_UX_CONTRACT.md` §9.1 **deleted that column outright** — no
   * alias, no legacy reading, no fallback — because the row already answers the question. A
   * declared `pack` means the quantity counts packs; no pack means it counts stock units, and the
   * two pack cells sit immediately to the left of the number they govern. The column was a
   * question whose answer was already on the same line, and the only argument for keeping it was
   * preserving the old meaning of a saved sheet's bare number, which does not apply: nothing has
   * reached production.
   *
   * This field stays, because stock-in's `counted_in` still needs it — one column that states
   * what another column means, on the one sheet where the two really are separate facts.
   */
  qualifies?: string | null
  /** True for stock-in `quantity` — the one column the user actually fills. */
  primaryInput: boolean
  helpText: string | null
  /** ENUM only, else null. */
  options: ImportFieldOption[] | null
}

// ------------------------------------------------------ §4 ImportRowResponse

export interface ImportRowIssue {
  /**
   * A field key — never rendered to the user as-is (contract §8.7).
   *
   * Null (so: ABSENT on the wire) for a whole-row problem with no single cell to blame —
   * `RowIssue`'s javadoc keeps that case open and the engine already builds one. A cell-less
   * issue has no outlined box to live in, so the review surfaces render it as a row-level line
   * instead of dropping it: an error nobody can see still blocks Continue, and a blocked button
   * with no stated reason is the worst screen this feature can produce.
   */
  column: string | null
  message: string
  /** The value one click would write into the cell. Null when there is nothing to guess. */
  suggestion: ImportFieldOption | null
  /**
   * Rows sharing the same `(column, code, raw value)`. Powers `[Fix all 12 "KGS" rows]`.
   * Non-null on every error that has one, so the frontend never computes it (contract §4).
   */
  bulkFixCount: number | null
}

export type ImportRowError = ImportRowIssue

/**
 * A non-blocking problem — and, since `UNIT_UX_CONTRACT.md` §5.1, sometimes a fixable one.
 *
 * `BULK_IMPORT_CONTRACT.md` §4 originally said warnings carry no `suggestion` and no
 * `bulkFixCount`, and that was right for the only warning that existed then: an update row's
 * ignored quantity (§8.8) is a fact about the row, not a defect, and a bulk button offering to
 * fix nothing is worse than no button. §5.1 then added the opposite shape — *"20 kg — did you
 * mean 20 bags (1,000 kg)?"* — which knows exactly what the user probably meant and which
 * `UNIT_UX_REMEDIATION_PLAN.md` §6.5 calls the highest-value warning the catalog import can
 * carry.
 *
 * The rule the backend adopted, and the one every surface here follows: **a warning carries a
 * count only when it also carries a suggestion.** That keeps §4's intent — never a bulk
 * affordance with nothing to apply — while letting the one warning that does have something to
 * apply offer it. Both fields are null on every pre-existing warning, so nothing that shipped
 * before changes shape.
 */
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
  /**
   * Per-row narrowing of an ENUM column's choices, keyed by field key — `UNIT_UX_CONTRACT.md`
   * §6.2.
   *
   * Populated for `counted_in` on every stock-in row whose product resolved, and it is the
   * single highest-value change on this screen: the descriptor's kind-wide `options` offer every
   * base unit in the system, of which exactly two are answerable for a given product ("kg" or
   * "Bag of 50 kg"). Offering the other twenty-eight is not generosity, it is the reported
   * complaint — plan §3's P1-1, a picker whose entries are guaranteed 400s.
   *
   * It lives on the ROW because the answer is a fact about this row's product; §6.1 deliberately
   * keeps `ImportFieldDescriptor.options` as the kind-wide fallback so the two cannot be
   * confused. **Absent, not null, when there is nothing to narrow** — Jackson `NON_NULL` — so
   * read it through `rowFieldOptions()` in `reviewColumns.ts`, which does the `== null` fallback
   * once instead of at every call site.
   *
   * Declared OPTIONAL rather than `| null`, unlike its neighbours above. The two spellings mean
   * different things to a TypeScript caller and only one of them is true here: `| null` alone
   * says the key is always present, which would oblige every fixture and every hand-built row to
   * write `fieldOptions: null` for a shape the server never sends. `?:` says what the wire says —
   * most rows simply do not carry this. (The older `| null` fields above predate the discovery
   * that NON_NULL omits them and are left alone; the file header already warns every reader to
   * treat all of them as nullish.)
   */
  fieldOptions?: Record<string, ImportFieldOption[]> | null
  /**
   * The server-composed `"= 2,000 kg"` that renders under the quantity cell — §6.2, and
   * non-negotiable 3 (*what the user typed and what the ledger records appear together*) applied
   * to the review grid.
   *
   * Composed server-side rather than here for the same reason every count on this screen is:
   * the conversion factor, the rounding rule and the stock unit's short symbol all live on the
   * server, and a second implementation of them in TypeScript is how a preview starts disagreeing
   * with the ledger it is previewing.
   *
   * Absent when there is nothing to convert — a row counted in its product's own stock unit
   * would render "= 20 kg" under a cell reading 20, which is noise, not reassurance. Optional
   * for the same reason `fieldOptions` is: absence is the ordinary case, not an exception.
   *
   * <h2>One echo per row, and it belongs to `opening_stock`</h2>
   * On a catalog row this is set for `opening_stock` and for nothing else. `low_stock_alert_at`
   * is counted exactly the same way (`UNIT_UX_CONTRACT.md` §9.1 — packs when the row declares
   * one) and is deliberately given no echo of its own: two conversions competing for one line of
   * space under a row read worse than one, and the alert threshold is not the number anybody is
   * checking on this screen. `quantityAnchorKey` in `reviewColumns.ts` is where the grid decides
   * which cell it lands under.
   */
  baseQuantityText?: string | null
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
