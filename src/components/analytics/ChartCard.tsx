import type { ReactNode } from 'react'

export interface ChartCardProps {
  title: string
  subtitle?: string
  children: ReactNode
}

export function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        {subtitle && <p className="text-xs text-neutral-500">{subtitle}</p>}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}
