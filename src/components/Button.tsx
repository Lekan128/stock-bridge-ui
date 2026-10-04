import type { ButtonHTMLAttributes } from 'react'
import { Spinner } from '@/components/Spinner'

/**
 * The button hierarchy (plan Track B, B2):
 * - `action`: the ONE main thing to do on a screen — Stock in, Add product, Create, Submit. Its
 *   colour is a token of its own (`--color-action`) so the §3 colour decision changes only that.
 * - `primary`: an important button that isn't the screen's action (a dialog's confirm).
 * - `secondary`: the default for everything else.
 * - `quiet`: text-weight, for "Cancel", "Show more" and actions inside rows.
 * - `danger`: only inside a confirmation or an overflow menu, never on a page header.
 */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  variant?: 'action' | 'primary' | 'secondary' | 'quiet' | 'danger'
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60'

const variants = {
  action: 'bg-action text-white hover:bg-action-hover focus-visible:ring-action',
  primary: 'bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-500',
  secondary:
    'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 focus-visible:ring-neutral-400',
  quiet: 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-neutral-400',
  danger: 'bg-danger-600 text-white hover:bg-danger-700 focus-visible:ring-danger-500',
}

/** Shares Button's visual style with non-<button> elements (e.g. a <Link> styled as a button). */
export function buttonClassName(variant: ButtonProps['variant'] = 'primary', className = ''): string {
  return `${base} ${variants[variant]} ${className}`
}

export function Button({
  type = 'button',
  loading = false,
  variant = 'primary',
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner size={16} />}
      {children}
    </button>
  )
}
