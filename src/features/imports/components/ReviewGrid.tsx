import { useRef, useState } from 'react'
import { CircleCheck, CircleSlash, CornerDownRight, Info, TriangleAlert } from 'lucide-react'
import { CellEditor } from '@/features/imports/components/CellEditor'
import { CellFix } from '@/features/imports/components/CellFix'
import { copy } from '@/features/imports/copy'
import { displayBooleanValue, displayEnumValue, displayValue } from '@/features/imports/reviewColumns'
import type {
  ImportCellValue,
  ImportFieldDescriptor,
  ImportRow,
} from '@/features/imports/types'

export interface ReviewGridProps {
  fields: ImportFieldDescriptor[]
  rows: ImportRow[]
  isRowBusy: (rowId: string) => boolean
  isValueBusy: (column: string, from: string) => boolean
  onEdit: (row: ImportRow, column: string, value: ImportCellValue) => void
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
  busy: boolean
  bulkBusy: boolean
  onEdit: (value: ImportCellValue) => void
  onBulkFix: (value: string, count: number) => void
}

function GridCell({ field, row, isFirst, busy, bulkBusy, onEdit, onBulkFix }: GridCellProps) {
  const [editing, setEditing] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const error = row.errors.find((candidate) => candidate.column === field.key)
  const warning = row.warnings.find((candidate) => candidate.column === field.key)
  const value = row.normalized[field.key] ?? null
  const shown =
    field.type === 'ENUM'
      ? displayEnumValue(field, value)
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
          label={copy.review.editCell(field.label, row.excelRow)}
          autoFocus
          busy={busy}
          invalid={!!error}
          onCommit={onEdit}
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

      {error && (
        <CellFix
          field={field}
          row={row}
          error={error}
          busy={busy}
          bulkBusy={bulkBusy}
          onEdit={onEdit}
          onBulkFix={onBulkFix}
        />
      )}
      {warning && !error && (
        <CellFix field={field} row={row} warning={warning} onEdit={onEdit} onBulkFix={onBulkFix} />
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
  rows,
  isRowBusy,
  isValueBusy,
  onEdit,
  onBulkFix,
  onToggleSkip,
}: ReviewGridProps) {
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

            return (
              <tr
                key={row.id}
                className={`border-b border-neutral-200 last:border-b-0 ${isSkipped ? 'bg-neutral-50' : 'bg-white'}`}
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
                    busy={busy}
                    bulkBusy={isValueBusy(field.key, String(row.raw[field.key] ?? ''))}
                    onEdit={(value) => onEdit(row, field.key, value)}
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
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
