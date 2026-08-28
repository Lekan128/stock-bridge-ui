import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CircleAlert, Info } from 'lucide-react'
import { CellEditor } from '@/features/imports/components/CellEditor'
import { copy } from '@/features/imports/copy'
import type {
  ImportCellValue,
  ImportFieldDescriptor,
  ImportRow,
  ImportRowError,
  ImportRowWarning,
} from '@/features/imports/types'

export interface CellFixProps {
  field: ImportFieldDescriptor
  row: ImportRow
  error?: ImportRowError
  warning?: ImportRowWarning
  busy?: boolean
  bulkBusy?: boolean
  onEdit: (value: ImportCellValue) => void
  onBulkFix: (value: string, count: number) => void
  /** Compact enough for a phone card; the grid passes false. */
  stacked?: boolean
}

/**
 * The repair affordance: what is wrong, the control to fix it, and — when the same wrong value
 * appears on other rows — the button that fixes all of them at once.
 *
 * Shared by the desktop grid cell and the mobile issue card so the two can never drift into
 * offering different repairs, which is how "fix it in place" quietly becomes "fix it in place,
 * except on a phone".
 *
 * `bulkFixCount` comes from the server on every error that has one (contract §4). It is never
 * computed here — the grid only ever holds one page of rows, so a count derived on the client
 * would silently undercount a 300-row file, and an undercounted "Fix all 4" that leaves 8 rows
 * broken is worse than no button at all.
 */
export function CellFix({
  field,
  row,
  error,
  warning,
  busy = false,
  bulkBusy = false,
  onEdit,
  onBulkFix,
  stacked = false,
}: CellFixProps) {
  const suggestion = error?.suggestion ?? null
  const [chosen, setChosen] = useState<string>(suggestion?.value ?? '')
  // Ties the sentence to the control that fixes it, rather than leaving them merely adjacent.
  const messageId = useId()

  const rawValue = row.raw[error?.column ?? warning?.column ?? field.key]
  const rawText = rawValue === null || rawValue === undefined ? '' : String(rawValue)
  const bulkCount = error?.bulkFixCount ?? null
  const canBulkFix = error != null && bulkCount != null && bulkCount > 1 && rawText !== ''

  const tone = error
    ? 'border-danger-200 bg-danger-50 text-danger-700'
    : 'border-warning-200 bg-warning-50 text-warning-700'
  const Icon = error ? CircleAlert : Info

  // Non-negotiable §8.8: an update row's quantity is ignored, and it must say so out loud and
  // point at the tool that does move stock — never a silent drop.
  const showStockInLink = warning != null && (warning.column === 'quantity_on_hand' || warning.column === 'quantity')

  return (
    // The min-width matters: inside a table cell the message, the editor and the bulk button all
    // collapse to a tall ribbon of one-word lines without it, which is unreadable exactly where
    // legibility counts most. 48 rather than 56, though — every column carrying an error widens
    // by this much, and four of them at 224px pushed a five-column grid 290px past the page.
    <div className={`mt-1.5 rounded-md border px-2.5 py-2 ${tone} ${stacked ? 'w-full' : 'min-w-48'}`}>
      <p id={messageId} className="flex items-start gap-1.5 text-xs leading-relaxed">
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{error?.message ?? warning?.message}</span>
      </p>

      {showStockInLink && (
        <Link
          to="/app/products/import/new?kind=STOCK_IN"
          className={`mt-1.5 inline-flex items-center gap-1 rounded-md py-1 text-xs font-medium text-primary-700 underline underline-offset-2 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
            stacked ? 'min-h-11' : ''
          }`}
        >
          {copy.review.stockInLink}
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      )}

      {error && !field.readOnly && (
        <div className={`mt-2 flex gap-2 ${stacked ? 'flex-col' : 'flex-wrap items-center'}`}>
          <div className={stacked ? 'w-full' : 'min-w-40 flex-1'}>
            <CellEditor
              field={field}
              value={row.normalized[error.column] ?? null}
              suggestedValue={suggestion?.value ?? null}
              label={copy.review.editCell(field.label, row.excelRow)}
              describedById={messageId}
              invalid
              busy={busy}
              // 44px on a phone: this control and the button beside it are the entire job on
              // mobile, and at their desktop height they were 30–34px targets.
              className={stacked ? 'min-h-11' : ''}
              onCommit={(value) => {
                setChosen(value === null ? '' : String(value))
                onEdit(value)
              }}
            />
          </div>

          {canBulkFix && (
            <button
              type="button"
              disabled={bulkBusy || chosen === ''}
              title={chosen === '' ? copy.review.bulkFixNeedsValue : undefined}
              onClick={() => onBulkFix(chosen, bulkCount)}
              className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-primary-200 bg-primary-50 px-2.5 py-1.5 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60 ${
                stacked ? 'min-h-11 w-full' : ''
              }`}
            >
              {copy.review.bulkFix(bulkCount, rawText)}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
