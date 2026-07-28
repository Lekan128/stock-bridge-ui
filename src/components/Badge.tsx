import type { HTMLAttributes } from 'react'

/**
 * `info` is the navy variant, added for order/payment states that are neither a warning nor a
 * finished-and-good result — an order that is confirmed or out for delivery is *in flight*, and
 * painting that emerald would make "on its way" indistinguishable from "delivered".
 */
export type BadgeVariant = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variants: Record<BadgeVariant, string> = {
  neutral: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  info: 'bg-primary-50 text-primary-700 border-primary-200',
  success: 'bg-accent-100 text-accent-800 border-accent-200',
  warning: 'bg-warning-100 text-warning-800 border-warning-200',
  danger: 'bg-danger-100 text-danger-700 border-danger-200',
}

export function Badge({ variant = 'neutral', className = '', children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}
