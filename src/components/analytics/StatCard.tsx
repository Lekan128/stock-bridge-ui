import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

export interface StatCardProps {
  label: string
  value: string
  subtitle?: string
  icon: LucideIcon
  // `success`/`danger` added alongside the existing `warning` so a census figure (well stocked)
  // and a sharper alarm (out of stock, strictly worse than merely low) each get their own
  // treatment — same variant names and tokens `Badge` already uses, not a new palette.
  variant?: 'default' | 'warning' | 'success' | 'danger'
  href?: string
}

const VARIANT_CLASSES: Record<NonNullable<StatCardProps['variant']>, { border: string; iconBg: string; label: string; value: string; subtitle: string }> = {
  default: {
    border: 'border-neutral-200 bg-white',
    iconBg: 'bg-primary-50 text-primary-600',
    label: 'text-neutral-900',
    value: 'text-neutral-900',
    subtitle: 'text-neutral-500',
  },
  warning: {
    border: 'border-warning-200 bg-warning-50',
    iconBg: 'bg-warning-100 text-warning-600',
    label: 'text-warning-900',
    value: 'text-warning-700',
    subtitle: 'text-warning-700',
  },
  success: {
    border: 'border-accent-200 bg-accent-50',
    iconBg: 'bg-accent-100 text-accent-600',
    label: 'text-accent-900',
    value: 'text-accent-700',
    subtitle: 'text-accent-700',
  },
  danger: {
    border: 'border-danger-200 bg-danger-50',
    iconBg: 'bg-danger-100 text-danger-600',
    label: 'text-danger-900',
    value: 'text-danger-700',
    subtitle: 'text-danger-700',
  },
}

export function StatCard({ label, value, subtitle, icon: Icon, variant = 'default', href }: StatCardProps) {
  const classes = VARIANT_CLASSES[variant]

  const card = (
    <div className={`h-full rounded-lg border p-5 ${classes.border}`}>
      <div className="flex items-center gap-2.5">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${classes.iconBg}`}>
          <Icon className="h-4 w-4" />
        </div>
        <p className={`text-sm font-medium ${classes.label}`}>{label}</p>
      </div>
      <p className={`mt-3 text-2xl font-semibold ${classes.value}`}>{value}</p>
      {subtitle && <p className={`mt-1 text-xs ${classes.subtitle}`}>{subtitle}</p>}
    </div>
  )

  if (href) {
    return (
      <Link to={href} className="block rounded-lg transition-shadow hover:shadow-sm">
        {card}
      </Link>
    )
  }

  return card
}
