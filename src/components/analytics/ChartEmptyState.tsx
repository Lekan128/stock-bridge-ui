import { BarChart3, type LucideIcon } from 'lucide-react'

export interface ChartEmptyStateProps {
  message?: string
  icon?: LucideIcon
}

export function ChartEmptyState({ message = 'No activity in this period', icon: Icon = BarChart3 }: ChartEmptyStateProps) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
      <Icon className="h-8 w-8 text-neutral-300" />
      <p className="text-sm text-neutral-500">{message}</p>
    </div>
  )
}
