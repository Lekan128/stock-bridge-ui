import { Fragment, useRef, useState } from 'react'
import { CircleCheck, CircleSlash, CornerDownRight, Info, TriangleAlert } from 'lucide-react'
import { CalculationDisclosure } from '@/features/imports/components/CalculationDisclosure'
import { CellEditor } from '@/features/imports/components/CellEditor'
import { CellFix } from '@/features/imports/components/CellFix'
import { PackCostEcho } from '@/features/imports/components/PackCostEcho'
import { copy } from '@/features/imports/copy'
import {
  displayBooleanValue,
  displayEnumValue,
  displayValue,
  isCostPerStockUnitField,
  issuesWithoutColumn,
  numericCellValue,
  quantityAnchorKey,
  rowFieldOptions,
  rowPackOption,
  rowStockUnitSymbol,
} from '@/features/imports/reviewColumns'
import type {
  ImportCellValue,
  ImportFieldDescriptor,
  ImportRow,
} from '@/features/imports/types'
import { costCalculationSentence, quantityCalculationSentence } from '@/features/products/unitCopy'
import type { UnitOption } from '@/features/products/types'

export interface ReviewGridProps {
  /** The columns being rendered — `visibleFields`, or all of them behind "Show every column". */
  fields: ImportFieldDescriptor[]
  /**
   * Every column the session describes, hidden ones included.
   *
   * The pack echo (`UNIT_UX_CONTRACT.md` §9.2) is built from a row's `stock_unit`, `pack` and
   * `units_per_pack` cells, and those three are optional, unflagged and therefore usually NOT on
   * screen — "Show only what matters" is doing its job when it hides them. Reading the descriptors
   * from the visible set would have meant the echo appeared only in the view where a reader least
   * needs it. Defaults to `fields`, so a caller with one list keeps working.
   */
  allFields?: ImportFieldDescriptor[]
  rows: ImportRow[]
  isRowBusy: (rowId: string) => boolean
  isValueBusy: (column: string, from: string) => boolean
  onEdit: (row: ImportRow, column: string, value: ImportCellValue) => void
  /** MULTI_PACK_PER_VENDOR_DESIGN.md §6a's one-click "Confirm" on a candidate pack. */
  onConfirmPack: (row: ImportRow, packagingUnit: string, packagingSize: number) => void
  onBulkFix: (row: ImportRow, column: string, value: string, count: number) => void
  onToggleSkip: (row: ImportRow, skipped: boolean) => void
}

/**
 * Tones are one step darker than the obvious pick on two of these: `warning-600` on white is
 * 3.19:1 and `neutral-400` is 2.57:1, both below the 4.5:1 AA floor for text this size. The 700
 * and 500 steps clear it (5.02:1 and 4.83:1) without changing what the row reads as.
 */
const STATUS_ICON = {
  VALID: { Icon: CircleCheck, className: 'text-accent-600', label: copy.review.statusValid },
  COMMITTED: { Icon: CircleCheck, className: 'text-accent-600', label: copy.review.statusCommitted },
  ERROR: { Icon: TriangleAlert, className: 'text-danger-600', label: copy.review.statusError },
  WARNING: { Icon: Info, className: 'text-warning-700', label: copy.review.statusWarning },
  SKIPPED: { Icon: CircleSlash, className: 'text-neutral-500', label: copy.review.statusSkipped },
} as const

interface GridCellProps {
  field: ImportFieldDescriptor
  row: ImportRow
  isFirst: boolean
  /** True on the cell that `baseQuantityText` belongs under (contract §6.2). */
  isQuantityAnchor: boolean
  /** This row's pack, or null when it declares none — `UNIT_UX_CONTRACT.md` §9.2. */
  packOption: UnitOption | null
  /** This row's stock unit symbol, for §9.2's stored-cost echo. */
  stockUnitLabel: string
  busy: boolean
  bulkBusy: boolean
  onEdit: (value: ImportCellValue) => void
  onConfirmPack: (packagingUnit: string, packagingSize: number) => void
  onBulkFix: (value: string, count: number) => void
}

function GridCell({
  field,
  row,
  isFirst,
  isQuantityAnchor,
  packOption,
  stockUnitLabel,
  busy,
  bulkBusy,
  onEdit,
  onConfirmPack,
  onBulkFix,
}: GridCellProps) {
  const [editing, setEditing] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  /*
   * What the cost echo is currently restating: the number being typed, or — before anyone has
   * typed anything, and after they have finished — the cell's own value.
   *
   * `undefined` is "no draft", which is why this is not just `ImportCellValue`: a cleared cell
   * commits a real null, and collapsing the two would make an emptied box fall back to showing an
   * echo of the value it used to hold. §9.2 wants the echo LIVE, and live means it tracks the
   * keystrokes rather than the last committed value half a second behind them.
   */
  const [draftValue, setDraftValue] = useState<ImportCellValue | undefined>(undefined)

  const error = row.errors.find((candidate) => candidate.column === field.key)
  const warning = row.warnings.find((candidate) => candidate.column === field.key)
  const value = row.normalized[field.key] ?? null
  // Resolved once and threaded through the reader, the editor and the fix panel, so all three
  // speak this row's unit set rather than the kind-wide one (`UNIT_UX_CONTRACT.md` §6.2). The
  // cell's own text has to come from the same list as its picker: the row's list labels `BAG`
  // as "Bag of 50 kg" — §1's single pack phrase — where the kind-wide list would say something
  // else for the same code, and one value reading two ways in one column is precisely the drift
  // this remediation exists to end.
  const options = rowFieldOptions(field, row)
  const shown =
    field.type === 'ENUM'
      ? displayEnumValue(options, value)
      : field.type === 'BOOLEAN'
        ? displayBooleanValue(value)
        : displayValue(value)
  // `!= null`. A normal row omits `continuationOf` rather than sending null, so `!== null` was
  // true for EVERY row: each one drew the continuation arrow, and the anchor cell rendered the
  // "second supplier for row …" label in place of the product's name.
  const isContinuation = row.continuationOf != null
  const isSkipped = row.status === 'SKIPPED'

  /**
   * What the cell reads when the server could not make sense of it.
   *
   * Validation nulls `normalized` on exactly the cells it rejected, so a cell rendered from
   * `normalized` alone shows an em-dash on the one cell whose contents the message beneath it is
   * about: an outlined box reading "—" above the sentence "We don't recognise KGS as a unit".
   * Spec §9.3 draws that cell with `KGS` in it, and rightly: the reader is matching this screen
   * against a spreadsheet they can see, and the value they typed is how they find the row. The
   * editor is unaffected — it still opens on `normalized` (or the server's suggestion) — so
   * nothing here makes the rejected text look like a value we accepted.
   */
  const rawValue = row.raw[field.key]
  const rawText = rawValue === null || rawValue === undefined ? '' : String(rawValue)
  // A cell validation rejected is DROPPED from `normalized`, not set to null there — so this
  // has to be a nullish check. With `=== null` the fallback never fired and the offending cell
  // rendered an em-dash directly above the message about its contents, which is the exact
  // regression contract §4 records M7 having already fixed once. It passed against the mock
  // because the mock writes a literal null; the wire sends nothing at all.
  const rejected = (error || warning) && (value == null || value === '') && rawText !== ''
  const display = rejected ? rawText : shown

  function closeEditor() {
    setEditing(false)
    // The draft is gone with the editor; the echo goes back to reading the committed cell.
    setDraftValue(undefined)
    // Hand focus back to where it came from, or a keyboard user is stranded mid-table.
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const body = (() => {
    if (isFirst && isContinuation) {
      return (
        <span className="inline-flex items-center gap-1.5 text-neutral-500">
          <CornerDownRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {copy.review.continuation}
        </span>
      )
    }
    if (field.readOnly || isSkipped) {
      return <span className={isSkipped ? 'text-neutral-500' : 'text-neutral-700'}>{display}</span>
    }
    if (editing) {
      return (
        <CellEditor
          field={field}
          value={value}
          options={options}
          label={copy.review.editCell(field.label, row.excelRow)}
          autoFocus
          busy={busy}
          invalid={!!error}
          onCommit={onEdit}
          onDraftChange={setDraftValue}
          onCancel={closeEditor}
        />
      )
    }
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setEditing(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === 'F2') {
            event.preventDefault()
            setEditing(true)
          }
        }}
        aria-label={copy.review.editCell(field.label, row.excelRow)}
        className="w-full rounded-md px-2 py-1 text-left text-neutral-800 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        {display}
      </button>
    )
  })()

  return (
    <td className="min-w-28 px-2 py-2 align-top">
      {error ? (
        <div className="rounded-md border-2 border-danger-500 bg-danger-50 px-1 py-1">{body}</div>
      ) : warning ? (
        <div className="rounded-md border-2 border-warning-300 bg-warning-50 px-1 py-1">{body}</div>
      ) : (
        body
      )}

      {/*
        `UNIT_UX_CONTRACT.md` §6.2 and non-negotiable 3: what the user typed and what the ledger
        will record, together. The cell above says "20" because that is what is in their file;
        this line says "= 1,000 kg" because that is what the movement will carry. Without it the
        grid repeats plan §3's P1-2 exactly — a screen that shows one number while the ledger
        takes another, and goes quiet on precisely the rows where a conversion is happening.

        Server-composed, rendered verbatim: the factor, the HALF_UP rounding and the stock unit's
        short symbol are all decided in one place, and a second implementation here is how a
        preview begins disagreeing with the thing it previews.

        Not colour alone and not decoration — it is text, and it sits in the reading order directly
        under the number it converts. Sighted readers get the compact server string because it has
        to fit under a narrow cell in a grid that already scrolls sideways; screen-reader users get
        the whole sentence instead, because "equals 1,000 kilograms" announced on its own, with no
        column header attached, is a fragment nobody can place. Same fact, two renderings, neither
        of them the other's afterthought — and `title` is deliberately not used, since it is not
        reliably announced and is unreachable by keyboard and touch.
      */}
      {isQuantityAnchor && row.baseQuantityText != null && row.baseQuantityText !== '' && (
        <>
          <p className="mt-1 px-2 text-xs font-medium whitespace-nowrap text-neutral-600 tabular-nums">
            <span aria-hidden="true">{row.baseQuantityText}</span>
            <span className="sr-only">{copy.review.baseQuantityTitle(row.baseQuantityText)}</span>
          </p>
          <CalculationDisclosure
            className="mt-0.5 px-2"
            sentence={quantityCalculationSentence(numericCellValue(value), packOption, stockUnitLabel, row.baseQuantityText)}
          />
        </>
      )}

      {/*
        The other half of the same idea, on the money column — `UNIT_UX_CONTRACT.md` §9.2.

        The line above says what the ledger will record for a quantity the user typed in packs.
        This one says what the price they typed PER PACK — the figure on the invoice in their
        other hand — will be stored as per stock unit, which is the number not otherwise on screen. Both exist so that no figure on
        this screen is stated in only one of the two units the row is about.

        Composed here rather than sent by the server, unlike the quantity line, and deliberately:
        it restates a value that is being TYPED, so there is nothing to send it about yet. The
        arithmetic is one multiplication by a factor the row itself declares, and it lives in
        `unitCopy.formatStockUnitCostEcho` — the same function the product form's cost field
        echo with — so the sentence is identical wherever a cost is entered.
      */}
      {isCostPerStockUnitField(field) && (
        <>
          <PackCostEcho
            className="mt-1 px-2"
            pricePerPack={numericCellValue(draftValue === undefined ? value : draftValue)}
            stockUnitLabel={stockUnitLabel}
            packOption={packOption}
          />
          <CalculationDisclosure
            className="mt-0.5 px-2"
            sentence={costCalculationSentence(
              numericCellValue(draftValue === undefined ? value : draftValue),
              packOption,
              stockUnitLabel,
            )}
          />
        </>
      )}

      {error && (
        <CellFix
          field={field}
          row={row}
          error={error}
          options={options}
          busy={busy}
          bulkBusy={bulkBusy}
          onEdit={onEdit}
          onConfirmPack={onConfirmPack}
          onBulkFix={onBulkFix}
        />
      )}
      {warning && !error && (
        <CellFix
          field={field}
          row={row}
          warning={warning}
          options={options}
          busy={busy}
          bulkBusy={bulkBusy}
          onEdit={onEdit}
          onConfirmPack={onConfirmPack}
          onBulkFix={onBulkFix}
        />
      )}
    </td>
  )
}

/**
 * The exception rendering.
 *
 * This grid is only ever mounted when a file has something wrong with it, and only above 768px
 * (contract §8.2 and §8.5). A clean file gets `CleanFileSummary` and a phone gets stacked cards
 * — a thirteen-column editable table is not a mobile experience, it is a punishment.
 *
 * `role="grid"` rather than a plain table because the cells are interactive: it tells assistive
 * technology this is something you move around inside and edit, which is exactly what it is.
 * Every cell is a real focusable control, so Tab walks the row and Enter opens the editor.
 */
export function ReviewGrid({
  fields,
  allFields,
  rows,
  isRowBusy,
  isValueBusy,
  onEdit,
  onConfirmPack,
  onBulkFix,
  onToggleSkip,
}: ReviewGridProps) {
  // Which of the columns actually being rendered carries the "= 2,000 kg" line. Computed from
  // the visible set, not the full descriptor list, so the conversion never tries to hang off a
  // column that "Show only what matters" has taken away.
  const anchorKey = quantityAnchorKey(fields)
  // The pack is read off the row's own cells (§9.1: the row declares its pack), so it has to be
  // looked up against every column the session has, not just the ones on screen.
  const packFields = allFields ?? fields

  return (
    // `overflow-x-auto` and nothing else: a fixed `min-w` made a five-column view 1,262px wide
    // inside a 974px page, so the Status column and its "leave this row out" button sat
    // permanently off-screen — the exact "the thing that needs fixing is off-screen" failure
    // spec §9.3 names. The table now takes the width it needs and only scrolls when it must.
    // `tabIndex`/`role`/`aria-label` on the scroll container, not decoration: a region that
    // scrolls horizontally must be reachable by keyboard on its own (WCAG 2.1.1), and a grid
    // this wide always can. Tabbing into a cell scrolls it into view, but only for cells that
    // are focusable — the Row and Status columns are not.
    <div
      tabIndex={0}
      role="region"
      aria-label={copy.review.gridRegion}
      className="overflow-x-auto rounded-lg border border-neutral-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      <table role="grid" className="w-full border-collapse text-sm">
        <caption className="sr-only">{copy.review.gridCaption}</caption>
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50">
            <th scope="col" className="w-16 px-3 py-2.5 text-left text-xs font-semibold text-neutral-600">
              {copy.review.colRow}
            </th>
            {fields.map((field) => (
              <th
                key={field.key}
                scope="col"
                className="px-2 py-2.5 text-left text-xs font-semibold whitespace-nowrap text-neutral-600"
              >
                {field.label}
                {field.required && (
                  <span className="ml-1 text-danger-600" aria-hidden="true">
                    *
                  </span>
                )}
              </th>
            ))}
            <th scope="col" className="w-36 px-3 py-2.5 text-right text-xs font-semibold text-neutral-600">
              {copy.review.colStatus}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const status = STATUS_ICON[row.status]
            const busy = isRowBusy(row.id)
            const isSkipped = row.status === 'SKIPPED'
            const isContinuation = row.continuationOf != null
            // Anything the cells above cannot show: an issue the server sent with no column, or
            // one naming a column these descriptors no longer list. See `issuesWithoutColumn` —
            // the alternative is a blocking error that appears nowhere while still counting
            // toward "4 need attention" and still disabling Continue.
            const orphanErrors = issuesWithoutColumn(fields, row.errors)
            const orphanWarnings = issuesWithoutColumn(fields, row.warnings)
            // The conversion line has nowhere to sit when the quantity column is not on screen.
            // It is the ledger's own number and it is not optional, so it moves to the row.
            const orphanConversion =
              anchorKey == null && row.baseQuantityText != null && row.baseQuantityText !== ''
            const packOption = rowPackOption(packFields, row)
            const rowStockUnit = rowStockUnitSymbol(packFields, row)

            const hasRowLevel = orphanErrors.length > 0 || orphanWarnings.length > 0 || orphanConversion

            return (
              <Fragment key={row.id}>
              <tr
                className={`${hasRowLevel ? '' : 'border-b border-neutral-200 last:border-b-0'} ${
                  isSkipped ? 'bg-neutral-50' : 'bg-white'
                }`}
              >
                <th
                  scope="row"
                  className={`px-3 py-2 text-left align-top text-xs font-medium ${
                    isContinuation ? 'pl-6 text-neutral-500' : 'text-neutral-500'
                  }`}
                >
                  {row.excelRow}
                  {isContinuation && (
                    <span className="sr-only"> {copy.review.continuationExplainer(row.continuationOf ?? 0)}</span>
                  )}
                </th>

                {fields.map((field, index) => (
                  <GridCell
                    key={field.key}
                    field={field}
                    row={row}
                    isFirst={index === 0}
                    isQuantityAnchor={field.key === anchorKey}
                    packOption={packOption}
                    stockUnitLabel={rowStockUnit}
                    busy={busy}
                    bulkBusy={isValueBusy(field.key, String(row.raw[field.key] ?? ''))}
                    onEdit={(value) => onEdit(row, field.key, value)}
                    onConfirmPack={(packagingUnit, packagingSize) => onConfirmPack(row, packagingUnit, packagingSize)}
                    onBulkFix={(value, count) => onBulkFix(row, field.key, value, count)}
                  />
                ))}

                <td className="px-3 py-2 text-right align-top">
                  <div className="flex flex-col items-end gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap ${status.className}`}
                    >
                      <status.Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {status.label}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onToggleSkip(row, !isSkipped)}
                      className="rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-neutral-500 underline underline-offset-2 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50"
                    >
                      {isSkipped ? copy.review.unskipRow : copy.review.skipRow}
                    </button>
                  </div>
                </td>
              </tr>

              {/*
                The row's own line, when something about it belongs to no single cell.

                Contract §8.4 forbids collecting errors into a table *below the grid* — the way
                `RowErrorsTable` used to — because a message thirty rows away from the cell it is
                about is a message nobody connects to anything. This is the opposite arrangement:
                the sentence is attached to its row, in reading order, sharing its background, and
                it exists only for issues that have no cell of their own. The alternative is not a
                tidier grid, it is an error that renders nowhere while still blocking Continue.
              */}
              {hasRowLevel && (
                <tr className={`border-b border-neutral-200 last:border-b-0 ${isSkipped ? 'bg-neutral-50' : 'bg-white'}`}>
                  <td colSpan={fields.length + 2} className="px-3 pb-2.5">
                    <div className="flex flex-col gap-1.5">
                      {orphanConversion && (
                        <p className="text-xs font-medium text-neutral-600 tabular-nums">
                          {copy.review.baseQuantityTitle(row.baseQuantityText ?? '')}
                        </p>
                      )}
                      {[...orphanErrors, ...orphanWarnings].map((issue, index) => (
                        <p
                          key={`${issue.column ?? 'row'}-${index}`}
                          className={`flex items-start gap-1.5 rounded-md border px-2.5 py-2 text-xs leading-relaxed ${
                            orphanErrors.includes(issue)
                              ? 'border-danger-200 bg-danger-50 text-danger-700'
                              : 'border-warning-200 bg-warning-50 text-warning-700'
                          }`}
                        >
                          {orphanErrors.includes(issue) ? (
                            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          ) : (
                            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          )}
                          <span>{issue.message}</span>
                        </p>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
