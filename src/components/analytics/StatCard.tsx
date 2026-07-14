import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

export interface StatCardProps {
  label: string
  value: string
  subtitle?: string
  icon: LucideIcon
  variant?: 'default' | 'warning'
  href?: string
}

export function StatCard({ label, value, subtitle, icon: Icon, variant = 'default', href }: StatCardProps) {
  const isWarning = variant === 'warning'

  const card = (
    <div
      className={`h-full rounded-lg border p-5 ${
        isWarning ? 'border-warning-200 bg-warning-50' : 'border-neutral-200 bg-white'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            isWarning ? 'bg-warning-100 text-warning-600' : 'bg-primary-50 text-primary-600'
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <p className={`text-sm font-medium ${isWarning ? 'text-warning-900' : 'text-neutral-900'}`}>{label}</p>
      </div>
      <p className={`mt-3 text-2xl font-semibold ${isWarning ? 'text-warning-700' : 'text-neutral-900'}`}>{value}</p>
      {subtitle && <p className={`mt-1 text-xs ${isWarning ? 'text-warning-700' : 'text-neutral-500'}`}>{subtitle}</p>}
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
