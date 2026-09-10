/**
 * Limits and thresholds, mirrored from `BULK_IMPORT_CONTRACT.md` §6.
 *
 * The backend holds the same numbers in `ImportLimits`. They MUST NOT drift: the dropzone
 * quotes MAX_ROWS and MAX_FILE_BYTES to the user before they pick a file, and the whole point
 * of stating a limit up front is that it is the real one.
 */

export const MAX_ROWS = 5000
export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const SESSION_TTL_HOURS = 48
/** 200 sync vs 202 async on commit. Backend-side concern; here only to explain a wait. */
export const ASYNC_ROW_THRESHOLD = 500
/** Suppliers offered in a dropdown before it stops being a picker. Wire name kept; see §1. */
export const VENDOR_DROPDOWN_CAP = 200
export const GRID_PAGE_SIZE = 50

/** Recent-imports lists are a glance, not a browse. */
export const RECENT_IMPORTS_PAGE_SIZE = 5

/**
 * How many value-resolution cards are shown before the rest go behind a "show the others".
 *
 * A file whose supplier column is entirely unknown produces one card per distinct value, and a
 * real one of those can carry hundreds. Rendering all of them puts the grid — and the Continue
 * button — tens of thousands of pixels down a page that takes seconds to lay out, and turns
 * "Apply all" into a promise to accept hundreds of fuzzy matches the reader never saw.
 */
export const VISIBLE_UNRESOLVED_VALUES = 20

/** Extensions the upload step accepts. CSV is contract-phase-2 but the picker allows it. */
export const ACCEPTED_EXTENSIONS = ['.xlsx', '.csv'] as const

/** Keystroke-settle before a cell edit is sent as a `patchRow` (spec §9.3). */
export const CELL_EDIT_DEBOUNCE_MS = 500

/** Below this the review screen drops the grid entirely (contract §8.5). */
export const MOBILE_BREAKPOINT_QUERY = '(max-width: 767px)'

/**
 * Base-role units offered by the inline "create this product" form (spec §6.7) when the
 * session's field descriptors cannot supply them.
 *
 * The stock-in template has no `stock_unit` column at all — it has `counted_in`, which is a
 * different question (which unit THIS row's number is in, `UNIT_UX_CONTRACT.md` §1) and whose
 * descriptor options are the kind-wide fallback rather than a product's stock unit. So a product
 * created inline during a stock-in has no descriptor to read a stock-unit list from.
 * Flagged onward: the clean fix is for `UnresolvedValue` of kind PRODUCT to carry the option
 * list, at which point this constant is deleted.
 *
 * Until then this list IS the dropdown — the descriptor lookup beside it can never answer for a
 * stock-in session, which is the only kind that asks a PRODUCT question at all. So it has to be
 * the backend's complete `UnitOfMeasure` BASE set and not a shortened one: an incomplete list
 * here is not a cosmetic gap, it is a unit the user cannot choose. All ten are below, codes
 * verbatim from the enum. Labels keep the British spellings the rest of this product uses.
 */
export const FALLBACK_BASE_UNITS = [
  { value: 'PIECE', label: 'Piece' },
  { value: 'MG', label: 'Milligram (mg)' },
  { value: 'G', label: 'Gram (g)' },
  { value: 'KG', label: 'Kilogram (kg)' },
  { value: 'T', label: 'Metric tonne (t)' },
  { value: 'ML', label: 'Millilitre (ml)' },
  { value: 'LITER', label: 'Litre (L)' },
  { value: 'MM', label: 'Millimetre (mm)' },
  { value: 'CM', label: 'Centimetre (cm)' },
  { value: 'M', label: 'Metre (m)' },
] as const
