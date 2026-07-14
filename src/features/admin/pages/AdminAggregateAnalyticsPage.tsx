import { useState } from 'react'
import { Building2, PackageCheck, PackageMinus, PackagePlus, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ChartCard } from '@/components/analytics/ChartCard'
import { DateRangeControl } from '@/components/analytics/DateRangeControl'
import { defaultDateRange, toApiDateTime, type DateRange } from '@/components/analytics/dateRange'
import { formatCompactCurrency, formatDateRange, formatNumber } from '@/components/analytics/formatters'
import { StatCard } from '@/components/analytics/StatCard'
import { SummaryCardsSkeleton } from '@/components/analytics/SummaryCardsSkeleton'
import { TenantBreakdownTable } from '@/features/admin/components/TenantBreakdownTable'
import { usePlatformAggregate } from '@/features/admin/hooks/usePlatformAggregate'
import type { TenantBreakdownEntry } from '@/features/admin/types'

export function AdminAggregateAnalyticsPage() {
  const navigate = useNavigate()
  const [range, setRange] = useState<DateRange>(defaultDateRange)

  const params = { from: toApiDateTime(range.from), to: toApiDateTime(range.to) }
  const rangeLabel = formatDateRange(range.from, range.to)

  const { data, loading, error } = usePlatformAggregate(params)

  function handleRowClick(entry: TenantBreakdownEntry) {
    navigate(`/admin/tenants/${entry.clientId}`)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Aggregate Analytics</h1>
          <p className="text-sm text-neutral-500">Platform-wide totals across every tenant.</p>
        </div>
        <DateRangeControl value={range} onChange={setRange} />
      </div>

      {loading && !data && <SummaryCardsSkeleton count={5} />}

      {error && !data && (
        <div className="rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      {data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Active Clients"
            value={formatNumber(data.totalActiveClients)}
            subtitle="Currently active on the platform"
            icon={Building2}
          />
          <StatCard label="Active Users" value={formatNumber(data.totalActiveUsers)} subtitle="Across all clients" icon={Users} />
          <StatCard
            label="Active Products"
            value={formatNumber(data.totalActiveProducts)}
            subtitle="Across all clients"
            icon={PackageCheck}
          />
          <StatCard
            label="Stock In Value"
            value={formatCompactCurrency(data.totalStockInValue)}
            subtitle={rangeLabel}
            icon={PackagePlus}
          />
          <StatCard
            label="Stock Out Value"
            value={formatCompactCurrency(data.totalStockOutValue)}
            subtitle={rangeLabel}
            icon={PackageMinus}
          />
        </div>
      )}

      <ChartCard title="Tenant breakdown" subtitle="Per-client activity for the selected range — click a row for details">
        {data && data.tenantBreakdown.length === 0 && (
          <p className="py-6 text-center text-sm text-neutral-500">No tenant activity in this period.</p>
        )}
        {data && data.tenantBreakdown.length > 0 && (
          <div className="overflow-x-auto">
            <TenantBreakdownTable entries={data.tenantBreakdown} onRowClick={handleRowClick} />
          </div>
        )}
      </ChartCard>
    </div>
  )
}
