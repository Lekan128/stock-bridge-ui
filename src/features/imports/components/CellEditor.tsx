import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { CELL_EDIT_DEBOUNCE_MS } from '@/features/imports/constants'
import { copy } from '@/features/imports/copy'
import type { ImportCellValue, ImportFieldDescriptor, ImportFieldOption } from '@/features/imports/types'

export interface CellEditorProps {
  field: ImportFieldDescriptor
  value: ImportCellValue
  /** Accessible name — the visible column header is in a <th>, which a lone input can't borrow. */
  label: string
  /**
   * What an ENUM cell may be set to, resolved for THIS row — `UNIT_UX_CONTRACT.md` §6.2.
   *
   * Callers pass `rowFieldOptions(field, row)`, which is the row's own `fieldOptions` when it
   * has them and the descriptor's kind-wide `options` when it does not. The editor takes the
   * resolved list rather than reading `field.options` itself so that there is exactly one place
   * the narrowing can be forgotten, and it is not this one: a "Counted in" cell built from the
   * descriptor offers every base unit in the system, of which two are answerable for the row's
   * product and the rest are guaranteed 400s (plan §3's P1-1 — the reported complaint).
   *
   * Undefined falls back to `field.options`, so the non-ENUM callers and the mapping panel keep
   * working untouched.
   */
  options?: readonly ImportFieldOption[] | null
  autoFocus?: boolean
  invalid?: boolean
  busy?: boolean
  /** Preselect a server suggestion the first time an ENUM editor opens on an error. */
  suggestedValue?: string | null
  /**
   * Id of the element holding this cell's error or warning message.
   *
   * Without it the message is merely *next to* the control: a screen-reader user who lands on
   * the input by Tab is told "Edit Stock unit on row 4" and nothing about what is wrong
   * with it, because the sentence explaining that lives in a sibling they have to go and find.
   */
  describedById?: string
  onCommit: (value: ImportCellValue) => void
  /**
   * Every keystroke, before the debounce that eventually commits it — for a caller that renders
   * something *derived* from the cell and has to keep up with the typing.
   *
   * `UNIT_UX_CONTRACT.md` §9.2 asks for the per-pack cost echo to be **live**, and it means live:
   * the whole job of "₦1,000/kg = ₦80,000/bag" is to catch a misplaced factor of eighty in the
   * same glance as the digit that caused it. An echo that only refreshed on commit would appear
   * half a second after the mistake, which is exactly when the reader has stopped looking.
   *
   * Optional and purely additive — it does not commit, does not touch the debounce, and every
   * existing caller omits it and behaves exactly as before.
   */
  onDraftChange?: (value: ImportCellValue) => void
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
  options,
  autoFocus = false,
  invalid = false,
  busy = false,
  suggestedValue = null,
  describedById,
  onCommit,
  onDraftChange,
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
    onDraftChange?.(coerce(field, next))
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
      // Whatever the caller derived from the abandoned draft has to be put back with it, or an
      // echo of a number the user just cancelled outlives the number itself.
      onDraftChange?.(coerce(field, initial))
      onCancel?.()
    }
  }

  const shared = `w-full rounded-md border px-2 py-1.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 disabled:opacity-60 ${
    invalid
      ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-100'
      : 'border-neutral-300 focus:border-primary-500 focus:ring-primary-100'
  } ${className}`

  // `options === undefined` means "the caller had nothing to say"; an explicit null or an empty
  // list means "there is genuinely nothing to narrow to", which falls back the same way §6.2's
  // absent `fieldOptions` does — to the kind-wide list — rather than rendering an empty picker.
  const enumOptions = options != null && options.length > 0 ? options : field.options

  if (field.type === 'ENUM' && enumOptions) {
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
        {enumOptions.map((option) => (
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
