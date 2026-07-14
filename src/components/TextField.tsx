import { forwardRef, type InputHTMLAttributes } from 'react'

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, id, name, className = '', ...props },
  ref,
) {
  const inputId = id ?? name
  const errorId = error ? `${inputId}-error` : undefined
  const hintId = hint ? `${inputId}-hint` : undefined

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-neutral-700">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        name={name}
        aria-invalid={!!error || undefined}
        aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
        className={`w-full rounded-md border px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 ${
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
