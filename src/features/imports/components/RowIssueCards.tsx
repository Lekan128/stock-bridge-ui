import { CircleSlash, CornerDownRight } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { CellFix } from '@/features/imports/components/CellFix'
import { copy } from '@/features/imports/copy'
import type { ImportCellValue, ImportFieldDescriptor, ImportRow } from '@/features/imports/types'

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

            <div className="mt-2 flex flex-col gap-2">
              {row.errors.map((error) => {
                const field = fields.find((candidate) => candidate.key === error.column)
                if (!field) return null
                return (
                  <CellFix
                    key={error.column}
                    stacked
                    field={field}
                    row={row}
                    error={error}
                    busy={busy}
                    bulkBusy={isValueBusy(error.column, String(row.raw[error.column] ?? ''))}
                    onEdit={(value) => onEdit(row, error.column, value)}
                    onBulkFix={(value, count) => onBulkFix(row, error.column, value, count)}
                  />
                )
              })}
              {row.warnings.map((warning) => {
                const field = fields.find((candidate) => candidate.key === warning.column)
                if (!field) return null
                return (
                  <CellFix
                    key={warning.column}
                    stacked
                    field={field}
                    row={row}
                    warning={warning}
                    onEdit={(value) => onEdit(row, warning.column, value)}
                    onBulkFix={(value, count) => onBulkFix(row, warning.column, value, count)}
                  />
                )
              })}
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
