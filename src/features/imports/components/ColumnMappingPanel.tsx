import { useState } from 'react'
import { Columns3 } from 'lucide-react'
import { Button } from '@/components/Button'
import { copy, fieldLabels } from '@/features/imports/copy'
import type { ImportSession } from '@/features/imports/types'

export interface ColumnMappingPanelProps {
  session: ImportSession
  saving: boolean
  error: string | null
  onSave: (columnMapping: Record<string, string | null>) => void
}

const IGNORE = '__ignore__'

/**
 * Shown only when `needsMapping` is true.
 *
 * Odoo shows this screen to everybody and NetSuite makes it step 3 of 5; both are wrong for the
 * common case. Someone who downloaded our template has a file whose headers already are our
 * field keys, and making them confirm thirteen identity mappings is pure ceremony. Someone who
 * pasted a supplier's price list genuinely needs it. One `if` separates the two.
 */
export function ColumnMappingPanel({ session, saving, error, onSave }: ColumnMappingPanelProps) {
  const headers = [...new Set([...Object.keys(session.columnMapping), ...session.unmappedHeaders])]
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const header of headers) initial[header] = session.columnMapping[header] ?? IGNORE
    return initial
  })

  const picked = Object.values(draft).filter((value) => value !== IGNORE)
  const chosen = new Set(picked)
  const missing = session.fields.filter((field) => field.required && !chosen.has(field.key)).map((field) => field.key)

  /**
   * Two of the user's columns pointed at the same field.
   *
   * Auto-mapping produces this on its own — a sheet with both `sku` and `Item code` has the
   * alias table matching them both — and until now the screen said nothing: whichever one the
   * server read last silently won, and the other column's data vanished with no message. It
   * blocks rather than warns, because there is no defensible guess between two columns of real
   * data.
   */
  const duplicates = [...new Set(picked.filter((value, index) => picked.indexOf(value) !== index))]

  return (
    <section aria-label={copy.mapping.title} className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
        <Columns3 className="h-4 w-4 text-neutral-400" aria-hidden="true" />
        {copy.mapping.title}
      </h2>
      <p className="mt-1 text-sm text-neutral-600">{copy.mapping.body}</p>

      <ul className="mt-4 flex flex-col gap-2">
        {headers.map((header) => (
          <li key={header} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <div className="min-w-0 sm:w-1/3">
              <p className="truncate text-sm font-medium text-neutral-800">{header}</p>
              <p className="text-xs text-neutral-500">{copy.mapping.yourColumn}</p>
            </div>
            <div className="sm:flex-1">
              <label className="sr-only" htmlFor={`map-${header}`}>
                {`${copy.mapping.ourField} — ${header}`}
              </label>
              <select
                id={`map-${header}`}
                value={draft[header]}
                disabled={saving}
                onChange={(event) => setDraft((current) => ({ ...current, [header]: event.target.value }))}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none disabled:opacity-60"
              >
                <option value={IGNORE}>{copy.mapping.ignore}</option>
                {session.fields.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label}
                    {field.required ? ' *' : ''}
                  </option>
                ))}
              </select>
            </div>
          </li>
        ))}
      </ul>

      {duplicates.length > 0 && (
        <p role="status" className="mt-4 rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-700">
          {copy.mapping.duplicate(fieldLabels(session.fields, duplicates))}
        </p>
      )}
      {missing.length > 0 && (
        <p role="status" className="mt-4 rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-700">
          {copy.mapping.missing(fieldLabels(session.fields, missing))}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {error}
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <Button
          loading={saving}
          disabled={missing.length > 0 || duplicates.length > 0}
          onClick={() => {
            const resolved: Record<string, string | null> = {}
            for (const [header, field] of Object.entries(draft)) {
              resolved[header] = field === IGNORE ? null : field
            }
            onSave(resolved)
          }}
        >
          {saving ? copy.mapping.saving : copy.mapping.save}
        </Button>
      </div>
    </section>
  )
}
