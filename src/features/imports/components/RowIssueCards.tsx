import { CircleSlash, CornerDownRight, Info, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { CalculationDisclosure } from '@/features/imports/components/CalculationDisclosure'
import { CellFix } from '@/features/imports/components/CellFix'
import { copy } from '@/features/imports/copy'
import {
  issuesWithoutColumn,
  numericCellValue,
  quantityAnchorKey,
  rowFieldOptions,
  rowPackOption,
  rowStockUnitSymbol,
} from '@/features/imports/reviewColumns'
import { quantityCalculationSentence } from '@/features/products/unitCopy'
import type {
  ImportCellValue,
  ImportFieldDescriptor,
  ImportRow,
  ImportRowIssue,
} from '@/features/imports/types'

export interface RowIssueCardsProps {
  fields: ImportFieldDescriptor[]
  rows: ImportRow[]
  isRowBusy: (rowId: string) => boolean
  isValueBusy: (column: string, from: string) => boolean
  onEdit: (row: ImportRow, column: string, value: ImportCellValue) => void
  onBulkFix: (row: ImportRow, column: string, value: string, count: number) => void
  onToggleSkip: (row: ImportRow, skipped: boolean) => void
}

/** What identifies this row to the person who typed it — a name if there is one, else the code. */
function rowTitle(row: ImportRow): string {
  const candidate =
    row.normalized.name ?? row.raw.name ?? row.normalized.product_name ?? row.raw.product_name ?? row.raw.sku
  return candidate === null || candidate === undefined || candidate === '' ? '' : String(candidate)
}

/**
 * The review screen below 768px (contract §8.5).
 *
 * Not a scaled-down grid — a different shape for a different situation. On a phone the whole
 * value of this screen is the handful of rows that need a decision, so that is all this shows:
 * one card per problem row, the message in full, the control to fix it, and the bulk button
 * when the same mistake is on other rows. No horizontal scrolling, nothing to pinch.
 */
export function RowIssueCards({
  fields,
  rows,
  isRowBusy,
  isValueBusy,
  onEdit,
  onBulkFix,
  onToggleSkip,
}: RowIssueCardsProps) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => {
        const busy = isRowBusy(row.id)
        const isSkipped = row.status === 'SKIPPED'
        const title = rowTitle(row)
        const orphanErrors: ImportRowIssue[] = issuesWithoutColumn(fields, row.errors)
        const orphans: ImportRowIssue[] = [...orphanErrors, ...issuesWithoutColumn(fields, row.warnings)]
        // §9.2's per-pack cost echo, for whichever repair panel below turns out to be the cost
        // cell. This component is handed the FULL descriptor list, so the three columns that
        // declare the pack are always available to read the row against.
        const rowStockUnit = rowStockUnitSymbol(fields, row)
        const packOption = rowPackOption(fields, row)
        // Same value the row-level conversion line above was built from, read directly since
        // this card renders no cell of its own for the quantity column — `CalculationDisclosure`
        // in `ReviewGrid` reads it off the cell it sits under instead.
        const quantityKey = quantityAnchorKey(fields)
        const enteredQuantity =
          quantityKey == null ? null : numericCellValue(row.normalized[quantityKey] ?? row.raw[quantityKey])

        return (
          <li key={row.id} className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-neutral-500">{copy.review.rowLabel(row.excelRow)}</p>
                <p className="truncate text-sm font-semibold text-neutral-900">{title || copy.review.continuation}</p>
                {/* `!= null` — see ReviewGrid: a normal row omits this field entirely. */}
                {row.continuationOf != null && (
                  <p className="mt-1 flex items-start gap-1 text-xs text-neutral-500">
                    <CornerDownRight className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                    {copy.review.continuationExplainer(row.continuationOf)}
                  </p>
                )}
              </div>
              {isSkipped ? (
                <Badge variant="neutral">{copy.review.skippedBadge}</Badge>
              ) : row.errors.length > 0 ? (
                // Per-row counts, not the file-wide ones: "1 need attention" on a single card
                // is both ungrammatical and easy to misread as the whole file's number.
                <Badge variant="danger">{copy.review.cardIssues(row.errors.length)}</Badge>
              ) : (
                <Badge variant="warning">{copy.review.cardChecks(row.warnings.length)}</Badge>
              )}
            </div>

            {/*
              `UNIT_UX_CONTRACT.md` §6.2 and non-negotiable 3, on the surface that needs it most.

              Contract §8.5 says a phone shows NO grid — so these cards are not a smaller version
              of the desktop screen, they are the *only* screen a phone user gets. Everything the
              grid states has to have a home here or it does not exist on mobile at all, and the
              conversion is the one line that stops "20" and "1,000 kg" being two different
              stories about the same delivery. It sits above the issues rather than below them
              because it is context for the row, not a problem with it.

              Rendered verbatim from the server. `!= null`, because the field is absent — not
              null — on every row that has nothing to convert.
            */}
            {row.baseQuantityText != null && row.baseQuantityText !== '' && (
              <>
                <p className="mt-2 text-xs font-medium text-neutral-600 tabular-nums">
                  {copy.review.baseQuantityTitle(row.baseQuantityText)}
                </p>
                <CalculationDisclosure
                  className="mt-0.5"
                  sentence={quantityCalculationSentence(enteredQuantity, packOption, rowStockUnit, row.baseQuantityText)}
                />
              </>
            )}

            <div className="mt-2 flex flex-col gap-2">
              {row.errors.map((error, index) => {
                // A cell-less issue has no cell to edit and no value to bulk-fix; it renders as a
                // plain message below instead. `column` is narrowed here rather than coerced,
                // because `row.raw[undefined]` and `onEdit(row, '', …)` would both quietly point
                // the repair at the wrong place, which is worse than not offering one.
                const column = error.column
                const field = column == null ? undefined : fields.find((c) => c.key === column)
                if (!field || column == null) return null
                return (
                  <CellFix
                    key={`${column}-${index}`}
                    stacked
                    field={field}
                    row={row}
                    error={error}
                    options={rowFieldOptions(field, row)}
                    packOption={packOption}
                    stockUnitLabel={rowStockUnit}
                    busy={busy}
                    bulkBusy={isValueBusy(column, String(row.raw[column] ?? ''))}
                    onEdit={(value) => onEdit(row, column, value)}
                    onBulkFix={(value, count) => onBulkFix(row, column, value, count)}
                  />
                )
              })}
              {row.warnings.map((warning, index) => {
                const column = warning.column
                const field = column == null ? undefined : fields.find((c) => c.key === column)
                if (!field || column == null) return null
                return (
                  <CellFix
                    key={`${column}-${index}`}
                    stacked
                    field={field}
                    row={row}
                    warning={warning}
                    options={rowFieldOptions(field, row)}
                    packOption={packOption}
                    stockUnitLabel={rowStockUnit}
                    busy={busy}
                    bulkBusy={isValueBusy(column, String(row.raw[column] ?? ''))}
                    onEdit={(value) => onEdit(row, column, value)}
                    onBulkFix={(value, count) => onBulkFix(row, column, value, count)}
                  />
                )
              })}

              {/*
                Whatever the cards above could not show: an issue the server sent with no column,
                or one naming a column these descriptors no longer list (a review that was open
                when the `unit`→`counted_in` rename deployed). Both used to render as nothing at
                all while still counting toward the card's "1 thing to fix" badge and still
                blocking Continue — a blocking error with no sentence anywhere on screen is the
                worst outcome this feature has.
              */}
              {orphans.map((issue, index) => (
                <p
                  key={`orphan-${index}`}
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

            <button
              type="button"
              disabled={busy}
              onClick={() => onToggleSkip(row, !isSkipped)}
              className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50"
            >
              <CircleSlash className="h-3.5 w-3.5" aria-hidden="true" />
              {isSkipped ? copy.review.unskipRow : copy.review.skipRow}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
