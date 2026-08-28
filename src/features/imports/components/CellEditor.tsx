import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { CELL_EDIT_DEBOUNCE_MS } from '@/features/imports/constants'
import { copy } from '@/features/imports/copy'
import type { ImportCellValue, ImportFieldDescriptor } from '@/features/imports/types'

export interface CellEditorProps {
  field: ImportFieldDescriptor
  value: ImportCellValue
  /** Accessible name — the visible column header is in a <th>, which a lone input can't borrow. */
  label: string
  autoFocus?: boolean
  invalid?: boolean
  busy?: boolean
  /** Preselect a server suggestion the first time an ENUM editor opens on an error. */
  suggestedValue?: string | null
  /**
   * Id of the element holding this cell's error or warning message.
   *
   * Without it the message is merely *next to* the control: a screen-reader user who lands on
   * the input by Tab is told "Edit Unit of measure on row 4" and nothing about what is wrong
   * with it, because the sentence explaining that lives in a sibling they have to go and find.
   */
  describedById?: string
  onCommit: (value: ImportCellValue) => void
  onCancel?: () => void
  className?: string
}

function coerce(field: ImportFieldDescriptor, raw: string): ImportCellValue {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  if (field.type === 'NUMBER' || field.type === 'MONEY' || field.type === 'INTEGER') {
    // "45,000" is what a spreadsheet user types; refusing it here would be gratuitous.
    const parsed = Number(trimmed.replace(/,/g, ''))
    return Number.isNaN(parsed) ? trimmed : parsed
  }
  return trimmed
}

function inputType(field: ImportFieldDescriptor): string {
  if (field.type === 'DATE') return 'date'
  if (field.type === 'NUMBER' || field.type === 'MONEY' || field.type === 'INTEGER') return 'text'
  return 'text'
}

/**
 * One cell's editor.
 *
 * Three commit paths, because there are three ways a person finishes with a cell: they stop
 * typing (debounced, so a 300-row file is not a keystroke-per-request firehose), they press
 * Enter, or they move on and it blurs. Escape puts the original value back and hands focus to
 * whoever asked for the editor — without that, keyboard users have no way out of a cell.
 */
export function CellEditor({
  field,
  value,
  label,
  autoFocus = false,
  invalid = false,
  busy = false,
  suggestedValue = null,
  describedById,
  onCommit,
  onCancel,
  className = '',
}: CellEditorProps) {
  const initial = value === null || value === undefined ? (suggestedValue ?? '') : String(value)
  const [draft, setDraft] = useState(initial)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const committedRef = useRef(initial)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function cancelPending() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  function commit(next: string) {
    cancelPending()
    if (next === committedRef.current) return
    committedRef.current = next
    onCommit(coerce(field, next))
  }

  function handleChange(next: string) {
    setDraft(next)
    cancelPending()
    timerRef.current = setTimeout(() => commit(next), CELL_EDIT_DEBOUNCE_MS)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit(draft)
      onCancel?.()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelPending()
      setDraft(initial)
      onCancel?.()
    }
  }

  const shared = `w-full rounded-md border px-2 py-1.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 disabled:opacity-60 ${
    invalid
      ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-100'
      : 'border-neutral-300 focus:border-primary-500 focus:ring-primary-100'
  } ${className}`

  if (field.type === 'ENUM' && field.options) {
    return (
      <select
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedById}
        autoFocus={autoFocus}
        disabled={busy}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
          commit(event.target.value)
        }}
        onKeyDown={handleKeyDown}
        className={shared}
      >
        <option value="">{copy.resolve.choose}</option>
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }

  if (field.type === 'BOOLEAN') {
    return (
      <select
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedById}
        autoFocus={autoFocus}
        disabled={busy}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
          commit(event.target.value)
        }}
        onKeyDown={handleKeyDown}
        className={shared}
      >
        <option value="">No</option>
        <option value="TRUE">Yes</option>
      </select>
    )
  }

  return (
    <input
      type={inputType(field)}
      inputMode={field.type === 'NUMBER' || field.type === 'MONEY' || field.type === 'INTEGER' ? 'decimal' : undefined}
      aria-label={label}
      aria-invalid={invalid || undefined}
      aria-describedby={describedById}
      title={copy.review.commitEdit}
      autoFocus={autoFocus}
      // Only where the editor opened *as* the cell — Enter on a grid cell. The existing text is
      // what the reader is replacing, and a caret parked after it turned "type the right value"
      // into "select all, then type the right value", which is not how any spreadsheet behaves.
      // The editors inside a fix panel are already beside their message and keep normal focus.
      onFocus={autoFocus ? (event) => event.currentTarget.select() : undefined}
      disabled={busy}
      value={draft}
      onChange={(event) => handleChange(event.target.value)}
      onBlur={() => commit(draft)}
      onKeyDown={handleKeyDown}
      className={shared}
    />
  )
}
