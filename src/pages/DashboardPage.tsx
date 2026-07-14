import { LowStockSummaryCard } from '@/features/products/components/LowStockSummaryCard'

export function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <LowStockSummaryCard />
      </div>
    </div>
  )
}
