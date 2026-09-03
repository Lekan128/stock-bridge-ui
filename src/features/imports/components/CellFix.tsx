import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CircleAlert, Info } from 'lucide-react'
import { CalculationDisclosure } from '@/features/imports/components/CalculationDisclosure'
import { CellEditor } from '@/features/imports/components/CellEditor'
import { PackCostEcho } from '@/features/imports/components/PackCostEcho'
import { copy } from '@/features/imports/copy'
import { isCostPerStockUnitField, numericCellValue } from '@/features/imports/reviewColumns'
import { costCalculationSentence } from '@/features/products/unitCopy'
import type {
  ImportCellValue,
  ImportFieldDescriptor,
  ImportFieldOption,
  ImportRow,
  ImportRowError,
  ImportRowWarning,
} from '@/features/imports/types'
import type { UnitOption } from '@/features/products/types'

export interface CellFixProps {
  field: ImportFieldDescriptor
  row: ImportRow
  error?: ImportRowError
  warning?: ImportRowWarning
  /** This row's ENUM choices — see `CellEditor`'s `options`, and `UNIT_UX_CONTRACT.md` §6.2. */
  options?: readonly ImportFieldOption[] | null
  /**
   * This row's pack, when it declares one — `UNIT_UX_CONTRACT.md` §9.2's per-pack cost echo.
   *
   * Only rendered on the stacked (phone) form. Contract §8.5 means the issue cards are the ONLY
   * screen a phone user gets, and the repair editor inside this panel is therefore the only place
   * a cost is ever typed on a phone — so if the echo is not here it does not exist on mobile at
   * all. The desktop grid renders it under the cell itself instead, where it belongs, and would
   * otherwise say the same thing twice in the space of two lines.
   */
  packOption?: UnitOption | null
  /** This row's stock unit symbol, for §9.2's stored-cost echo. Defaults to §2.1's "units". */
  stockUnitLabel?: string
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
 *
 * <h2>Warnings can be repairable now</h2>
 * `UNIT_UX_CONTRACT.md` §5.1 introduced a warning that knows the answer — *"20 kg — did you mean
 * 20 bags (1,000 kg)?"* — and asks for the same one-click and bulk affordances the errors get.
 * The rule that keeps `BULK_IMPORT_CONTRACT.md` §4's intent intact is **the suggestion, not the
 * severity**: a repair control appears on a warning only when the server sent a concrete value a
 * click would write. Every warning that predates the change sends none, so the informational
 * ones — chiefly §8.8's ignored quantity — still render as a sentence and a link and nothing
 * else, which is right, because there is nothing about them to fix.
 */
export function CellFix({
  field,
  row,
  error,
  warning,
  options,
  packOption = null,
  stockUnitLabel = 'units',
  busy = false,
  bulkBusy = false,
  onEdit,
  onBulkFix,
  stacked = false,
}: CellFixProps) {
  // One of the two, whichever is present; error wins when a cell somehow has both, because the
  // blocking problem is the one the reader has to deal with first.
  const issue = error ?? warning
  const suggestion = issue?.suggestion ?? null
  const [chosen, setChosen] = useState<string>(suggestion?.value ?? '')
  // What §9.2's echo is restating while the user types. `undefined` means "nothing typed yet",
  // distinct from a real null — see the same field on `ReviewGrid`'s `GridCell`.
  const [draftValue, setDraftValue] = useState<ImportCellValue | undefined>(undefined)
  // Ties the sentence to the control that fixes it, rather than leaving them merely adjacent.
  const messageId = useId()

  // `?? field.key` covers the whole-row issue that names no column at all: it still has to quote
  // the file back and still has to be repairable where it can be, and a lookup on `undefined`
  // would quietly return nothing.
  const column = issue?.column ?? field.key
  const rawValue = row.raw[column]
  const rawText = rawValue === null || rawValue === undefined ? '' : String(rawValue)

  // A warning is only ever repairable when it carries a value to apply — see the class note.
  const repairable = error != null || suggestion != null
  const bulkCount = issue?.bulkFixCount ?? null
  const canBulkFix = repairable && bulkCount != null && bulkCount > 1 && rawText !== ''

  const tone = error
    ? 'border-danger-200 bg-danger-50 text-danger-700'
    : 'border-warning-200 bg-warning-50 text-warning-700'
  const Icon = error ? CircleAlert : Info

  // Non-negotiable §8.8: an update row's quantity is ignored, and it must say so out loud and
  // point at the tool that does move stock — never a silent drop. `opening_stock` is the column's
  // name and stays it through `UNIT_UX_CONTRACT.md` §9.4 (§9.1 changed what the number MEANS, not
  // what the column is called); `quantity_on_hand` is its permanent read alias, so a review that
  // was already open when the rename deployed keeps its link.
  const showStockInLink =
    warning != null &&
    (warning.column === 'opening_stock' ||
      warning.column === 'quantity_on_hand' ||
      warning.column === 'quantity')

  return (
    // The min-width matters: inside a table cell the message, the editor and the bulk button all
    // collapse to a tall ribbon of one-word lines without it, which is unreadable exactly where
    // legibility counts most. 48 rather than 56, though — every column carrying an error widens
    // by this much, and four of them at 224px pushed a five-column grid 290px past the page.
    <div className={`mt-1.5 rounded-md border px-2.5 py-2 ${tone} ${stacked ? 'w-full' : 'min-w-48'}`}>
      <p id={messageId} className="flex items-start gap-1.5 text-xs leading-relaxed">
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{issue?.message}</span>
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

      {repairable && !field.readOnly && (
        <div className={`mt-2 flex gap-2 ${stacked ? 'flex-col' : 'flex-wrap items-center'}`}>
          <div className={stacked ? 'w-full' : 'min-w-40 flex-1'}>
            <CellEditor
              field={field}
              value={row.normalized[column] ?? null}
              options={options}
              suggestedValue={suggestion?.value ?? null}
              label={copy.review.editCell(field.label, row.excelRow)}
              describedById={messageId}
              // `aria-invalid` states a fact, and a warning's cell is not invalid — the value is
              // legal, we are only asking whether it is what was meant. Marking it invalid would
              // tell a screen-reader user the field is wrong when the visible rendering says
              // "worth a look", which is exactly the kind of disagreement that makes people stop
              // trusting the announcements.
              invalid={error != null}
              busy={busy}
              // 44px on a phone: this control and the button beside it are the entire job on
              // mobile, and at their desktop height they were 30–34px targets.
              className={stacked ? 'min-h-11' : ''}
              onDraftChange={setDraftValue}
              onCommit={(value) => {
                setChosen(value === null ? '' : String(value))
                onEdit(value)
              }}
            />
            {stacked && isCostPerStockUnitField(field) && (
              <>
                <PackCostEcho
                  className="mt-1"
                  pricePerPack={numericCellValue(
                    draftValue === undefined ? (row.normalized[column] ?? null) : draftValue,
                  )}
                  stockUnitLabel={stockUnitLabel}
                  packOption={packOption}
                />
                <CalculationDisclosure
                  className="mt-0.5"
                  sentence={costCalculationSentence(
                    numericCellValue(draftValue === undefined ? (row.normalized[column] ?? null) : draftValue),
                    packOption,
                    stockUnitLabel,
                  )}
                />
              </>
            )}
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
              {/* §8.3: a bulk affordance always states its count. Which sentence it states it in
                  depends on whether the offending value is worth quoting — "KGS" identifies the
                  mistake and is the fastest way for a reader to recognise it, but the
                  opening-stock warning's raw value is a bare number ("20") and `Fix all 12 "20"
                  rows` reads like a bug. Same button, same count, honest phrasing either way. */}
              {error != null
                ? copy.review.bulkFix(bulkCount, rawText)
                : copy.review.bulkFixRows(bulkCount)}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
