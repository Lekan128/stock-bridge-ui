import { forwardRef, type InputHTMLAttributes } from 'react'

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
  /** The label for screen readers only, where the field already says what it is (an area's name on its card). */
  hideLabel?: boolean
  /** Says "Required" beside the label (owner, 2026-11-10): what must be filled is clear before anything is typed. */
  requiredMark?: boolean
}

/**
 * "Required", beside a label. In words, not a lone *, because most fields on a form are optional and the few that
 * aren't should say so plainly to someone who reads slowly.
 */
export function RequiredTag() {
  // Seen, not read out as part of the field's name: the control itself says it's required (aria-required).
  return (
    <span aria-hidden="true" className="ml-1.5 rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-700">
      Required
    </span>
  )
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, hideLabel = false, requiredMark = false, id, name, className = '', ...props },
  ref,
) {
  const inputId = id ?? name
  const errorId = error ? `${inputId}-error` : undefined
  const hintId = hint ? `${inputId}-hint` : undefined

  return (
    <div>
      {requiredMark && !hideLabel ? (
        // The tag beside the label, not in it: the field's name stays "Name"; the control says it's required.
        <div className="mb-1.5 flex items-center">
          <label htmlFor={inputId} className="block text-sm font-medium text-neutral-700">
            {label}
          </label>
          <RequiredTag />
        </div>
      ) : (
        <label htmlFor={inputId} className={hideLabel ? 'sr-only' : 'mb-1.5 block text-sm font-medium text-neutral-700'}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        name={name}
        aria-invalid={!!error || undefined}
        aria-required={requiredMark || undefined}
        aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
        // The `disabled:` variants matter wherever a field is gated on an earlier answer
        // (PACK_ENTRY_REDESIGN.md §6.1 disables "How many ... in one pack?" until a stock unit is
        // chosen). Without them a disabled input is pixel-identical to an enabled one and the
        // user just finds that typing does nothing, which is worse than not showing the field.
        className={`w-full rounded-md border px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-50 disabled:text-neutral-400 ${
          error
            ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-100'
            : 'border-neutral-200 focus:border-primary-500 focus:ring-primary-100'
        } ${className}`}
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-neutral-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-danger-600">
          {error}
        </p>
      )}
    </div>
  )
})
