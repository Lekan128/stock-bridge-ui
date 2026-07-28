import { useMemo } from 'react'
import { formatNumber } from '@/components/analytics/formatters'
import { REVENUE_COLOR, VOLUME_COLOR } from '@/features/marketplace/analytics/chartPalette'
import { RankedBarsChart, type RankedRow } from '@/features/marketplace/analytics/components/RankedBarsChart'
import { SegmentedControl } from '@/features/marketplace/analytics/components/SegmentedControl'
import type { ProductMetric, TopSellingProductEntry } from '@/features/marketplace/analytics/types'
import { formatNaira } from '@/utils/money'

export interface TopProductsPanelProps {
  data: TopSellingProductEntry[] | null
  loading: boolean
  error: string | null
  onRetry: () => void
  metric: ProductMetric
  onMetricChange: (metric: ProductMetric) => void
}

/**
 * What is selling, by money or by volume.
 *
 * The two rankings answer different questions: REVENUE tells the commercial side what to
 * negotiate on, QUANTITY tells the warehouse what to restock. A pallet of generator sets
 * beats a thousand sachets on one and loses badly on the other.
 *
 * `buyingCompanies` sits in every tooltip because it separates "one distributor bulk-buying"
 * from "everybody wants this" — a top-seller carried by a single customer is a
 * concentration risk, not a hit product.
 */
export function TopProductsPanel({ data, loading, error, onRetry, metric, onMetricChange }: TopProductsPanelProps) {
  const rows = useMemo<RankedRow[] | null>(() => {
    if (!data) return null
    return data.map((entry) => ({
      id: entry.productId,
      label: entry.name,
      value: metric === 'REVENUE' ? entry.revenue : entry.quantitySold,
      details: [
        { label: 'SKU', value: entry.sku },
        { label: 'Category', value: entry.categoryName },
        { label: 'Revenue', value: formatNaira(entry.revenue) },
        { label: 'Units sold', value: formatNumber(entry.quantitySold) },
        { label: 'Orders', value: formatNumber(entry.orderCount) },
        { label: 'Companies', value: formatNumber(entry.buyingCompanies) },
      ],
    }))
  }, [data, metric])

  return (
    <RankedBarsChart
      rows={rows}
      loading={loading}
      error={error}
      onRetry={onRetry}
      unit={metric === 'REVENUE' ? 'currency' : 'count'}
      color={metric === 'REVENUE' ? REVENUE_COLOR : VOLUME_COLOR}
      emptyMessage="No products sold in this period"
      controls={
        <SegmentedControl
          label="Rank products by"
          value={metric}
          onChange={onMetricChange}
          options={[
            { value: 'REVENUE', label: 'Revenue' },
            { value: 'QUANTITY', label: 'Quantity' },
          ]}
        />
      }
    />
  )
}
