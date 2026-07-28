import { useMemo } from 'react'
import { formatNumber } from '@/components/analytics/formatters'
import { REVENUE_COLOR, VOLUME_COLOR } from '@/features/marketplace/analytics/chartPalette'
import { RankedBarsChart, type RankedRow } from '@/features/marketplace/analytics/components/RankedBarsChart'
import { SegmentedControl } from '@/features/marketplace/analytics/components/SegmentedControl'
import { daysSince, formatDate } from '@/features/marketplace/analytics/formatters'
import type { CustomerMetric, TopCustomerEntry } from '@/features/marketplace/analytics/types'
import { formatNaira } from '@/utils/money'

export interface TopCustomersPanelProps {
  data: TopCustomerEntry[] | null
  loading: boolean
  error: string | null
  onRetry: () => void
  metric: CustomerMetric
  onMetricChange: (metric: CustomerMetric) => void
}

/**
 * Who is buying, ranked by spend or by frequency.
 *
 * The two metrics disagree constantly and that is the point: one large customer placing a
 * single ₦5m order and a distributor placing forty ₦120k ones are different relationships,
 * and only having both views makes that visible.
 *
 * Every bar carries lifetime spend and last-order date in its tooltip. In-window revenue
 * alone cannot show churn — a company with a large lifetime number and an old last order is
 * exactly the row worth a phone call, and it looks unremarkable on the bar itself.
 */
export function TopCustomersPanel({
  data,
  loading,
  error,
  onRetry,
  metric,
  onMetricChange,
}: TopCustomersPanelProps) {
  const rows = useMemo<RankedRow[] | null>(() => {
    if (!data) return null
    return data.map((entry) => {
      const idleDays = daysSince(entry.lastOrderAt)
      return {
        id: entry.clientId,
        label: entry.name,
        value: metric === 'REVENUE' ? entry.revenue : entry.orderCount,
        details: [
          { label: 'Orders this period', value: formatNumber(entry.orderCount) },
          { label: 'Revenue this period', value: formatNaira(entry.revenue) },
          { label: 'Units bought', value: formatNumber(entry.unitsPurchased) },
          { label: 'Lifetime spend', value: formatNaira(entry.lifetimeSpend) },
          { label: 'Lifetime orders', value: formatNumber(entry.lifetimeOrderCount) },
          {
            label: 'Last order',
            // The gap matters more than the date: "12 Feb 2026 (94 days ago)" reads as a
            // churn risk at a glance where a bare date does not.
            value: idleDays == null ? '—' : `${formatDate(entry.lastOrderAt)} (${formatNumber(idleDays)}d ago)`,
          },
        ],
      }
    })
  }, [data, metric])

  return (
    <RankedBarsChart
      rows={rows}
      loading={loading}
      error={error}
      onRetry={onRetry}
      unit={metric === 'REVENUE' ? 'currency' : 'count'}
      color={metric === 'REVENUE' ? REVENUE_COLOR : VOLUME_COLOR}
      emptyMessage="No company bought anything in this period"
      controls={
        <SegmentedControl
          label="Rank customers by"
          value={metric}
          onChange={onMetricChange}
          options={[
            { value: 'REVENUE', label: 'Revenue' },
            { value: 'ORDERS', label: 'Orders' },
          ]}
        />
      }
    />
  )
}
