import { useState } from 'react'
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  Users as UsersIcon,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChartCard } from '@/components/analytics/ChartCard'
import { DateRangeControl } from '@/components/analytics/DateRangeControl'
import { defaultDateRange, granularityForRange, toApiDateTime, type DateRange } from '@/components/analytics/dateRange'
import { formatCompactCurrency, formatDateRange, formatNumber } from '@/components/analytics/formatters'
import { MovementsChart } from '@/components/analytics/MovementsChart'
import { StatCard } from '@/components/analytics/StatCard'
import { SummaryCardsSkeleton } from '@/components/analytics/SummaryCardsSkeleton'
import { TopProductsChart } from '@/components/analytics/TopProductsChart'
import type { TopProductsDirection, TopProductsMetric } from '@/components/analytics/types'
import { Button } from '@/components/Button'
import { useToast } from '@/components/useToast'
import { superAdminApiClient } from '@/features/admin/api/superAdminApi'
import { ClientStatusBadge } from '@/features/admin/components/ClientStatusBadge'
import { SuspendClientDialog } from '@/features/admin/components/SuspendClientDialog'
import { formatDate } from '@/features/admin/formatters'
import { useClientAnalyticsSummary } from '@/features/admin/hooks/useClientAnalyticsSummary'
import { useClientDetail } from '@/features/admin/hooks/useClientDetail'
import { useClientMovementsOverTime } from '@/features/admin/hooks/useClientMovementsOverTime'
import { useClientTopProducts } from '@/features/admin/hooks/useClientTopProducts'
import { isAppError } from '@/types/api'

const TOP_PRODUCTS_LIMIT = 8

export function AdminTenantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { client, setClient, loading, error } = useClientDetail(id)
  const [range, setRange] = useState<DateRange>(defaultDateRange)
  const [metric, setMetric] = useState<TopProductsMetric>('value')
  const [direction, setDirection] = useState<TopProductsDirection>('in')
  const [confirmSuspend, setConfirmSuspend] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)

  const params = { from: toApiDateTime(range.from), to: toApiDateTime(range.to) }
  const granularity = granularityForRange(range.from, range.to)
  const rangeLabel = formatDateRange(range.from, range.to)

  const { data: summary, loading: summaryLoading, error: summaryError } = useClientAnalyticsSummary(id, params)
  const {
    data: movements,
    loading: movementsLoading,
    error: movementsError,
  } = useClientMovementsOverTime(id, { ...params, granularity })
  const {
    data: topProducts,
    loading: topProductsLoading,
    error: topProductsError,
  } = useClientTopProducts(id, { ...params, by: metric, direction, limit: TOP_PRODUCTS_LIMIT })

  async function handleActivate() {
    if (!client) return
    setStatusUpdating(true)
    try {
      const updated = await superAdminApiClient.updateClientStatus(client.id, true)
      setClient(updated)
      showToast(`${updated.name} reactivated.`, 'success')
    } catch (err) {
      showToast(isAppError(err) ? err.message : 'Could not reactivate this client.', 'error')
    } finally {
      setStatusUpdating(false)
    }
  }

  async function handleConfirmSuspend() {
    if (!client) return
    setStatusUpdating(true)
    try {
      const updated = await superAdminApiClient.updateClientStatus(client.id, false)
      setClient(updated)
      setConfirmSuspend(false)
      showToast(`${updated.name} suspended.`, 'success')
    } catch (err) {
      showToast(isAppError(err) ? err.message : 'Could not suspend this client.', 'error')
    } finally {
      setStatusUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-10 text-center text-sm text-neutral-500">
        Loading…
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
        {error ?? 'Client not found.'}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/tenants')}
            aria-label="Back to tenants"
            className="mt-0.5 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-neutral-900">{client.name}</h1>
              <ClientStatusBadge active={client.active} />
            </div>
            <p className="mt-0.5 text-sm text-neutral-500">
              {client.slug} · {client.adminEmail} · Created {formatDate(client.createdAt)}
            </p>
          </div>
        </div>
        <div>
          {client.active ? (
            <Button variant="danger" onClick={() => setConfirmSuspend(true)}>
              Suspend
            </Button>
          ) : (
            <Button variant="secondary" loading={statusUpdating} onClick={() => void handleActivate()}>
              Activate
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active Users" value={formatNumber(client.activeUserCount)} icon={UsersIcon} />
        <StatCard label="Active Products" value={formatNumber(client.activeProductCount)} icon={PackageCheck} />
        <StatCard
          label="Low Stock"
          value={formatNumber(client.lowStockProductCount)}
          subtitle={client.lowStockProductCount > 0 ? 'Needs attention' : 'All stocked up'}
          icon={AlertTriangle}
          variant={client.lowStockProductCount > 0 ? 'warning' : 'default'}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-neutral-900">Analytics</h2>
        <DateRangeControl value={range} onChange={setRange} />
      </div>

      {summaryLoading && !summary && <SummaryCardsSkeleton />}

      {summaryError && !summary && (
        <div className="rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {summaryError}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Stock In Value"
            value={formatCompactCurrency(summary.totalInValue)}
            subtitle={rangeLabel}
            icon={PackagePlus}
          />
          <StatCard
            label="Stock Out Value"
            value={formatCompactCurrency(summary.totalOutValue)}
            subtitle={rangeLabel}
            icon={PackageMinus}
          />
          <StatCard
            label="Units Moved In"
            value={formatNumber(summary.totalUnitsIn)}
            subtitle={rangeLabel}
            icon={ArrowDownToLine}
          />
          <StatCard
            label="Units Moved Out"
            value={formatNumber(summary.totalUnitsOut)}
            subtitle={rangeLabel}
            icon={ArrowUpFromLine}
          />
        </div>
      )}

      <ChartCard title="Movements over time" subtitle="Stock-in vs stock-out value">
        <MovementsChart data={movements} loading={movementsLoading} error={movementsError} granularity={granularity} />
      </ChartCard>

      <ChartCard title="Top products" subtitle="Ranked by value or quantity, in or out">
        <TopProductsChart
          data={topProducts}
          loading={topProductsLoading}
          error={topProductsError}
          metric={metric}
          onMetricChange={setMetric}
          direction={direction}
          onDirectionChange={setDirection}
        />
      </ChartCard>

      <SuspendClientDialog
        open={confirmSuspend}
        clientName={client.name}
        loading={statusUpdating}
        onConfirm={() => void handleConfirmSuspend()}
        onCancel={() => setConfirmSuspend(false)}
      />
    </div>
  )
}
