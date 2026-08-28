import type { ImportFieldDescriptor, ImportRow } from '@/features/imports/types'

/** Columns that identify a row to a human, so they stay on screen whatever else is hidden. */
const ANCHOR_KEYS = ['name', 'sku', 'product_name']

/**
 * A product-catalog file has thirteen columns and a stock-in file has nine. Rendering all of
 * them turns the review grid into a horizontal scroll where the thing that needs fixing is
 * off-screen — which is the failure mode this whole screen exists to avoid.
 *
 * So the grid shows what the user has to *act on*: whatever identifies the row, whatever is
 * required, the one column they came here to fill (stock-in's `quantity`), and any column
 * carrying an error or a warning on the rows currently visible. Everything else is one click
 * away behind "Show every column".
 *
 * Note the dependency on the visible rows: paging to a set of rows with a different problem
 * brings that problem's column into view by itself.
 */
export function visibleFields(fields: ImportFieldDescriptor[], rows: ImportRow[]): ImportFieldDescriptor[] {
  const flagged = new Set<string>()
  for (const row of rows) {
    for (const error of row.errors) flagged.add(error.column)
    for (const warning of row.warnings) flagged.add(warning.column)
  }

  const keep = fields.filter(
    (field) => ANCHOR_KEYS.includes(field.key) || field.required || field.primaryInput || flagged.has(field.key),
  )

  // A file with no problems and nothing required beyond the anchors would otherwise show two
  // columns and look broken, so top up from the front of the template order.
  if (keep.length >= 4) return keep
  const kept = new Set(keep.map((field) => field.key))
  return [...keep, ...fields.filter((field) => !kept.has(field.key))].slice(0, 5)
}

/** What a cell shows when it holds nothing. An em dash, never an empty box. */
export const EMPTY_CELL = '—'

export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return EMPTY_CELL
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

/**
 * The label for a BOOLEAN cell.
 *
 * The template's own spelling is the literal `TRUE`, and that is what arrives in `raw` — but the
 * editor for this column offers "Yes"/"No", so a cell reading `TRUE` beside an editor reading
 * "Yes" is the same fact spelled two ways in the same row. `displayValue` only handled a real
 * boolean; the string form needs the same treatment.
 */
export function displayBooleanValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return EMPTY_CELL
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  const text = String(value).trim().toUpperCase()
  if (text === 'TRUE' || text === 'YES' || text === '1') return 'Yes'
  if (text === 'FALSE' || text === 'NO' || text === '0') return 'No'
  return String(value)
}

/**
 * The label for an ENUM cell — the file holds `KG`, the user reads "Kilogram (kg)". A code with
 * no matching option falls back to the code itself rather than disappearing.
 */
export function displayEnumValue(field: ImportFieldDescriptor, value: unknown): string {
  if (value === null || value === undefined || value === '') return EMPTY_CELL
  const match = field.options?.find((option) => option.value === String(value))
  return match?.label ?? String(value)
}
