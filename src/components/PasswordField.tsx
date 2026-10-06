import { Eye, EyeOff } from 'lucide-react'
import { forwardRef, useState, type InputHTMLAttributes } from 'react'

export interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  error?: string
  hint?: string
}

/**
 * A password input with a Show/Hide button, so a new password is typed once and checked by eye
 * instead of typed twice (LANDING_PAGE_PLAN.md §4). Same label, hint and error layout as TextField.
 */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { label, error, hint, id, name, className = '', ...props },
  ref,
) {
  const [visible, setVisible] = useState(false)
  const inputId = id ?? name
  const errorId = error ? `${inputId}-error` : undefined
  const hintId = hint ? `${inputId}-hint` : undefined

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-neutral-700">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          name={name}
          type={visible ? 'text' : 'password'}
          aria-invalid={!!error || undefined}
          aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
          className={`w-full rounded-md border py-2 pr-20 pl-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:outline-none ${
            error
              ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-100'
              : 'border-neutral-200 focus:border-primary-500 focus:ring-primary-100'
          } ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-pressed={visible}
          aria-controls={inputId}
          className="absolute inset-y-0 right-0 flex items-center gap-1.5 rounded-r-md px-3 text-sm font-medium text-primary-600 hover:text-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
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
