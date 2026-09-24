import { copy } from '@/features/imports/copy'
import {
  displayBooleanValue,
  displayEnumValue,
  displayValue,
  rowFieldOptions,
  rowTitle,
} from '@/features/imports/reviewColumns'
import type { ImportFieldDescriptor, ImportRow } from '@/features/imports/types'

const TITLE_KEYS = ['name', 'product_name']

/**
 * A clean file's rows on a phone, for the reader who opened "See all N rows".
 *
 * Contract §8.5 keeps the grid off screens below 768px, and `RowIssueCards` is built around a
 * problem to fix — a clean row there would wear a "0 things to check" badge. So this is the
 * plainest thing that lets someone match the screen against their sheet: the row number they
 * can find in Excel, the product's name, and the columns that matter, read-only.
 */
export function CleanRowList({ fields, rows }: { fields: ImportFieldDescriptor[]; rows: ImportRow[] }) {
  const detailFields = fields.filter((field) => !TITLE_KEYS.includes(field.key))

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => {
        const title = rowTitle(row)
        return (
          <li key={row.id} className="rounded-lg border border-neutral-200 bg-white p-4">
            <p className="text-xs font-medium text-neutral-500">{copy.review.rowLabel(row.excelRow)}</p>
            <p className="truncate text-sm font-semibold text-neutral-900">{title || copy.review.continuation}</p>
            {detailFields.length > 0 && (
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                {detailFields.map((field) => {
                  const value = row.normalized[field.key] ?? row.raw[field.key] ?? null
                  const shown =
                    field.type === 'ENUM'
                      ? displayEnumValue(rowFieldOptions(field, row), value)
                      : field.type === 'BOOLEAN'
                        ? displayBooleanValue(value)
                        : displayValue(value)
                  return (
                    <div key={field.key} className="contents">
                      <dt className="text-neutral-500">{field.label}</dt>
                      <dd className="min-w-0 truncate text-neutral-900">{shown}</dd>
                    </div>
                  )
                })}
              </dl>
            )}
          </li>
        )
      })}
    </ul>
  )
}
