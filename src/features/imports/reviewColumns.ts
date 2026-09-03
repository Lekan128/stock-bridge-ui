import type {
  ImportFieldDescriptor,
  ImportFieldOption,
  ImportRow,
  ImportRowIssue,
} from '@/features/imports/types'
import type { UnitOption } from '@/features/products/types'
import { packPhrase, stockUnitSymbol } from '@/features/products/unitCopy'

/** Columns that identify a row to a human, so they stay on screen whatever else is hidden. */
const ANCHOR_KEYS = ['name', 'sku', 'product_name']

/**
 * Field keys whose cell is the natural anchor for a row's `baseQuantityText`.
 *
 * `primaryInput` answers this on the stock-in sheet (contract §4: true for exactly one column
 * per kind, and it is `quantity`) and is checked first. The catalog sheet marks nothing as
 * primary, so `opening_stock` is named here as well.
 *
 * That second entry stopped being speculative with `UNIT_UX_CONTRACT.md` §9.1. `opening_stock`
 * now counts PACKS whenever the row declares one — 30 beside a Keg of 50 ml is 1,500 ml — and the
 * server composes the `"= 1,500 ml"` for exactly that column, so the catalog grid has a real
 * conversion to land and this is where it lands. Only `opening_stock` gets one: §9.1 deliberately
 * gives `low_stock_alert_at` no echo, because two conversions competing for one line under a row
 * read worse than one.
 *
 * `quantity_on_hand` is `opening_stock`'s permanent read alias (`UNIT_UX_CONTRACT.md` §9.4), so
 * a session uploaded before the rename still finds its anchor.
 */
const QUANTITY_KEYS = ['quantity', 'opening_stock', 'quantity_on_hand']

/**
 * The catalog columns that, taken together, say what one pack of this row's product is —
 * `UNIT_UX_CONTRACT.md` §9.4's names, which are also the header, the field key and the label.
 *
 * Spelled here rather than at the two call sites so the pack echo and the pack-riding column rule
 * cannot start disagreeing about which cells describe a pack.
 */
const STOCK_UNIT_KEY = 'stock_unit'
const PACK_KEY = 'pack'
const UNITS_PER_PACK_KEY = 'units_per_pack'

/**
 * The catalog's cost column — per STOCK unit, never per pack (`UNIT_UX_CONTRACT.md` §9.2).
 *
 * Stock-in's `cost_per_unit` is deliberately NOT here. That one is per whatever the row's
 * "Counted in" says, so on a row counted in bags it is already the per-bag figure and a per-pack
 * echo under it would restate the number it is echoing. §9.2's echo exists for the one column
 * whose basis a reader has to divide an invoice down to.
 */
const COST_PER_STOCK_UNIT_KEY = 'cost_price'

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
 *
 * <h2>Read-only columns with nothing in them are dropped</h2>
 * `UNIT_UX_CONTRACT.md` §5.2 removed the units-per-pack column from the stock-in sheet, but M3
 * had to keep it as a read-only field descriptor: the "we now take the pack from your product
 * setup, so this column is ignored" warning needs a cell to attach to, and an issue whose column
 * resolves to no field has nowhere to render. The cost is a column that is permanently empty for
 * every user who downloaded their template after the change — which is, within one 48-hour
 * retention window, all of them.
 *
 * A dead column is not free. It is a header a reader has to interpret ("Units per pack — am I
 * meant to fill this in?"), one more thing between them and the cell they came here for, and on
 * a grid that already scrolls sideways it costs the width that pushes the Status column
 * off-screen. So a read-only column with no value on any visible row is hidden — and *only* a
 * read-only one, because an empty editable column is a column somebody may still need to fill.
 *
 * The warning is untouched by this. A row that carries the ignored-`units_per_pack` warning has
 * a value in that column by definition (that is why it warned), so the column is present on
 * exactly the pages where the warning is — and if it ever were not, the issue renders as a
 * row-level line rather than disappearing (see {@link issuesWithoutColumn}).
 */
export function visibleFields(fields: ImportFieldDescriptor[], rows: ImportRow[]): ImportFieldDescriptor[] {
  const flagged = new Set<string>()
  for (const row of rows) {
    for (const error of row.errors) if (error.column) flagged.add(error.column)
    for (const warning of row.warnings) if (warning.column) flagged.add(warning.column)
  }

  /*
   * The quantity column rides along whenever any visible row has a conversion to show.
   *
   * `opening_stock` is optional, is not the primary input on the catalog sheet, and on a file
   * whose only problem is a duplicate SKU it is not flagged either — so all of this function's
   * other reasons to keep a column miss it, and it was hidden on exactly the files where §9.1
   * changed what its number means. The conversion line survived that (it falls back to a row-level
   * line rather than being dropped) but a row-level "Your stock will go up by 1,500 ml." repeated
   * forty times, with no cell above it reading 30, is a worse rendering than the one it replaces.
   *
   * Non-negotiable 3 wants the typed number and the ledger's number *together*. Together means
   * one above the other, and that needs the cell.
   */
  const hasConversion = rows.some((row) => row.baseQuantityText != null && row.baseQuantityText !== '')
  const conversionAnchor = hasConversion ? quantityAnchorKey(fields) : null

  /*
   * The cost column rides along on the same terms, and only when it has a job to do here.
   *
   * `UNIT_UX_CONTRACT.md` §9.2 anchors cost to the stock unit and then commits, in the same
   * paragraph, to echoing the per-pack equivalent *wherever a cost is entered beside a product
   * that has a pack* — because the invoice in the reader's other hand says "₦80,000 a bag" and
   * the cell wants ₦1,000. A cost typed on the wrong basis is an eighty-fold error that nothing
   * else on this screen would catch: it is a perfectly legal number, so it draws no warning, and
   * the review step is the last moment before it becomes the cost of an opening balance.
   *
   * Conditioned on a row that has BOTH a pack and a cost, so a file with no packs — or one where
   * nobody filled the cost in — pays no width for a column with nothing to say. Same shape as the
   * conversion anchor above: a column earns its place by having something to state on the rows
   * actually on screen.
   */
  const costEarnsItsPlace = rows.some(
    (row) => rowPackOption(fields, row) != null && numericCellValue(cellValue(row, COST_PER_STOCK_UNIT_KEY)) != null,
  )

  // A column that states what another column MEANS rides along with it. Nothing else here would
  // show it: it is optional, never the primary input, and never flagged, so a sheet lacking the
  // column offered no way to set it and the quantity's unit could not be corrected at all.
  const qualifierSubjectsWithData = new Set(
    fields
      .filter((field) => field.qualifies != null)
      .map((field) => field.qualifies as string)
      .filter((subjectKey) => {
        const subject = fields.find((field) => field.key === subjectKey)
        return subject != null && hasAnyValue(subject, rows)
      }),
  )

  const keep = fields.filter(
    (field) =>
      (ANCHOR_KEYS.includes(field.key) ||
        field.required ||
        field.primaryInput ||
        flagged.has(field.key) ||
        field.key === conversionAnchor ||
        (costEarnsItsPlace && isCostPerStockUnitField(field)) ||
        (field.qualifies != null && qualifierSubjectsWithData.has(field.qualifies))) &&
      (!field.readOnly || flagged.has(field.key) || hasAnyValue(field, rows)),
  )

  // A file with no problems and nothing required beyond the anchors would otherwise show two
  // columns and look broken, so top up from the front of the template order — still skipping the
  // dead read-only ones, which are the last thing a thin grid needs padding out with.
  if (keep.length >= 4) return keep
  const kept = new Set(keep.map((field) => field.key))
  return [
    ...keep,
    ...fields.filter(
      (field) => !kept.has(field.key) && (!field.readOnly || hasAnyValue(field, rows)),
    ),
  ].slice(0, 5)
}

/** True when any of these rows has something in this column. Blank strings do not count. */
function hasAnyValue(field: ImportFieldDescriptor, rows: ImportRow[]): boolean {
  return rows.some((row) => {
    const normalized = row.normalized[field.key]
    if (normalized != null && normalized !== '') return true
    const raw = row.raw[field.key]
    return raw != null && raw !== ''
  })
}

/**
 * The choices this row's ENUM cell may actually be set to — `UNIT_UX_CONTRACT.md` §6.2.
 *
 * The row's own `fieldOptions` when it has them, the descriptor's kind-wide `options` when it
 * does not. That fallback is the contract's, not a convenience: §6.1 keeps the descriptor's list
 * deliberately as the kind-wide answer, and a stock-in row whose product never resolved has no
 * unit set to narrow to — offering it the base units is the only honest thing left, and the row
 * is carrying an error about its product anyway.
 *
 * `== null`, never `=== null`: `fieldOptions` is omitted from the JSON entirely when there is
 * nothing to narrow (Jackson `NON_NULL`), so it arrives as `undefined` and a strict check would
 * take the "row has options" branch on every row and hand every cell an empty picker.
 */
export function rowFieldOptions(
  field: ImportFieldDescriptor,
  row: ImportRow,
): readonly ImportFieldOption[] | null {
  const perRow = row.fieldOptions?.[field.key]
  if (perRow != null && perRow.length > 0) return perRow
  return field.options
}

/** A cell's value as a number, whatever shape it arrived in. Null when it is not one. */
export function numericCellValue(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  // "45,000" is what a spreadsheet user types, and `raw` keeps it exactly as typed.
  const parsed = Number(value.trim().replace(/,/g, ''))
  return value.trim() === '' || Number.isNaN(parsed) ? null : parsed
}

/** Whatever this row holds for a column: the repaired value first, the file's own text after. */
function cellValue(row: ImportRow, key: string): unknown {
  const normalized = row.normalized[key]
  if (normalized != null && normalized !== '') return normalized
  const raw = row.raw[key]
  return raw != null && raw !== '' ? raw : null
}

/** The label an ENUM column's descriptor gives a code, or null when it does not know it. */
function optionLabel(fields: ImportFieldDescriptor[], key: string, code: string | null): string | null {
  if (code == null || code === '') return null
  const field = fields.find((candidate) => candidate.key === key)
  return field?.options?.find((option) => option.value === code)?.label ?? null
}

/** True for the one column §9.2's per-pack echo belongs under. */
export function isCostPerStockUnitField(field: ImportFieldDescriptor): boolean {
  return field.key === COST_PER_STOCK_UNIT_KEY
}

/**
 * This row's pack, as the `UnitOption` `formatPackCostEcho` takes — `UNIT_UX_CONTRACT.md` §9.2.
 *
 * <h2>Why it is built from the row rather than fetched</h2>
 * A catalog row carries no `fieldOptions`: §6.2 populates that for `counted_in` on stock-in rows
 * whose product resolved, and the catalog sheet has neither of those things. What it does carry is
 * the pack itself — §9.1's whole point is that *the row declares its own pack*, in the three cells
 * `stock_unit`, `pack` and `units_per_pack` sitting immediately to the left of the numbers they
 * govern. So the answer is on the row, and reading it there is the same rule the server applies
 * (`ProductCatalogRowHandler.countedIn` builds its option from the same three cells, scoped to the
 * row and deliberately not widened to the stored product).
 *
 * The two codes are turned into words through the session's own descriptor `options` — the same
 * list the pickers in those cells offer — rather than through a second fetch of the unit list.
 * One session, one set of names for a code. A code the descriptor cannot name returns null and
 * the echo simply does not render: `UNIT_UX_CONTRACT.md` §2 is explicit that a `UnitOption.label`
 * is never a raw code, and "KEG of 50 ml" under a cost box would be worse than silence.
 *
 * Returns null unless there is a real, convertible pack that is not the stock unit itself —
 * which is also every case `formatPackCostEcho` would refuse, so a caller needs no guard of its
 * own. `isDefault` is true because §9.3 makes the pack the catalog sheet's entry default.
 */
/**
 * This row's stock unit as a short symbol ("kg") — the unit `formatStockUnitCostEcho` states its
 * stored figure in. Built from the same cell and the same descriptor options as
 * {@link rowPackOption}, so the two can never disagree about what the row declares.
 *
 * Falls back to §2.1's "units" rather than a raw code, per §7's rule that a code is our vocabulary
 * and not the reader's.
 */
export function rowStockUnitSymbol(fields: ImportFieldDescriptor[], row: ImportRow): string {
  const stockUnitCode = cellValue(row, STOCK_UNIT_KEY)
  const label = typeof stockUnitCode === 'string' ? optionLabel(fields, STOCK_UNIT_KEY, stockUnitCode) : null
  return stockUnitSymbol(label)
}

export function rowPackOption(fields: ImportFieldDescriptor[], row: ImportRow): UnitOption | null {
  const packCode = cellValue(row, PACK_KEY)
  const stockUnitCode = cellValue(row, STOCK_UNIT_KEY)
  if (typeof packCode !== 'string' || packCode === '') return null
  // A pack that IS the stock unit converts by one, so the echo would restate the number above it.
  if (typeof stockUnitCode === 'string' && stockUnitCode === packCode) return null

  const unitsPerPack = numericCellValue(cellValue(row, UNITS_PER_PACK_KEY))
  if (unitsPerPack == null || unitsPerPack <= 0) return null

  const packLabel = optionLabel(fields, PACK_KEY, packCode)
  if (packLabel == null) return null

  const stockUnitLabel =
    typeof stockUnitCode === 'string' ? optionLabel(fields, STOCK_UNIT_KEY, stockUnitCode) : null
  // §1: a pack is always the single phrase "Bag of 50 kg", never a bare noun beside a number.
  const label = packPhrase(packLabel, unitsPerPack, stockUnitSymbol(stockUnitLabel))
  if (label == null) return null

  return {
    code: packCode,
    label,
    factorToStockUnit: unitsPerPack,
    isStockUnit: false,
    isDefault: true,
    isPack: true,
  }
}

/**
 * Which cell a row's `baseQuantityText` belongs under — contract §6.2 says "the quantity cell",
 * and this is the one place that decides which column that is.
 *
 * Resolved against the columns actually being rendered, so the conversion line never lands on a
 * column that was hidden; when it would, the caller falls back to a row-level line rather than
 * dropping it. Returns null when the row has nothing to convert.
 */
export function quantityAnchorKey(fields: ImportFieldDescriptor[]): string | null {
  const primary = fields.find((field) => field.primaryInput)
  if (primary) return primary.key
  return fields.find((field) => QUANTITY_KEYS.includes(field.key))?.key ?? null
}

/**
 * Issues that have no cell to render into — because the server sent no `column` (a whole-row
 * problem, which `RowIssue` explicitly allows), or because the column it named is not among the
 * fields being rendered.
 *
 * Both cases used to render as nothing at all: `errors.find(e => e.column === field.key)` simply
 * never matched, the message vanished, and on the desktop grid the row still counted toward
 * "4 need attention" and still blocked Continue. A blocking error with no sentence anywhere on
 * screen is the single worst outcome this feature has, and it is exactly what §8.4 ("errors
 * render in place, message beneath") is for — "in place" cannot mean "nowhere" when there is no
 * place.
 *
 * The second case is not hypothetical: a file uploaded before the `unit`→`counted_in`,
 * `unit_cost`→`cost_per_unit` or `unit_of_measure`→`stock_unit` renames holds the old keys in
 * its stored rows, and its issues point at columns today's descriptors do not list. The catalog
 * sheet's deleted `opening_stock_counted_in` lands here too, for the same reason and permanently:
 * §9.1 removed the column outright, so a review that was open when it went reads its issues
 * against a field no descriptor will ever describe again.
 */
export function issuesWithoutColumn(
  fields: ImportFieldDescriptor[],
  issues: readonly ImportRowIssue[],
): ImportRowIssue[] {
  const rendered = new Set(fields.map((field) => field.key))
  return issues.filter((issue) => issue.column == null || !rendered.has(issue.column))
}

/**
 * True when these rows were parsed against a different set of field keys than the ones the
 * server is describing now.
 *
 * `UNIT_UX_CONTRACT.md` §5.2 renamed three stock-in columns and §9.4 renamed four catalog ones.
 * The old spellings stay permanent read *aliases*, so any file uploaded from here on maps
 * correctly — but a review that was already in progress when the rename deployed has its
 * `normalized` map keyed the old way, and every cell the grid asks for comes back empty. The
 * session expires within 48 hours (contract §6.1) so this heals itself, and rewriting stored
 * rows to chase it would mean this module editing data it does not own.
 *
 * What it must not do is heal itself *silently*. A grid of empty cells with a Continue button
 * under it invites someone to import a file they can no longer see — so the review screen says
 * what happened and what to do about it, in the one sentence that is true: upload it again.
 *
 * The test is deliberately conservative — a row is only stale when it has data and *none* of its
 * keys is a field we know. A partially-recognised row is a mapping question, which the mapping
 * panel already owns and answers better.
 */
export function hasStaleFieldKeys(fields: ImportFieldDescriptor[], rows: ImportRow[]): boolean {
  if (fields.length === 0 || rows.length === 0) return false
  const known = new Set(fields.map((field) => field.key))
  return rows.some((row) => {
    const keys = [...Object.keys(row.normalized), ...Object.keys(row.raw)]
    return keys.length > 0 && !keys.some((key) => known.has(key))
  })
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
 * The label for an ENUM cell — the file holds `BAG`, the user reads "Bag of 50 kg". A code with
 * no matching option falls back to the code itself rather than disappearing.
 *
 * Takes the resolved option list rather than the descriptor, so a `counted_in` cell reads back
 * in the same words its picker offers: the row's own list labels `BAG` as the pack phrase
 * "Bag of 50 kg" (`UNIT_UX_CONTRACT.md` §1 — pack is always one phrase, never a bare noun),
 * while the kind-wide list would have shown a different string for the same code. Two names for
 * one value in one column is the drift this whole remediation is about.
 */
export function displayEnumValue(options: readonly ImportFieldOption[] | null, value: unknown): string {
  if (value === null || value === undefined || value === '') return EMPTY_CELL
  const match = options?.find((option) => option.value === String(value))
  return match?.label ?? String(value)
}
