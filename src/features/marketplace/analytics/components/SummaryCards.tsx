import {
  Ban,
  Building2,
  ClipboardList,
  Coins,
  HandCoins,
  Package,
  Repeat,
  Sparkles,
  Truck,
  Wallet,
} from 'lucide-react'
import { formatNumber } from '@/components/analytics/formatters'
import { MetricCard } from '@/features/marketplace/analytics/components/MetricCard'
import { formatShare } from '@/features/marketplace/analytics/formatters'
import type { MarketplaceAnalyticsSummary } from '@/features/marketplace/analytics/types'
import { formatNaira, formatNairaCompact } from '@/utils/money'

export interface SummaryCardsProps {
  summary: MarketplaceAnalyticsSummary
}

/**
 * The headline grid. Ten figures, in the order an operator asks about them: what did we
 * make, how much did we sell, who bought, and what is still owed to somebody.
 *
 * Money uses the compact formatter on the tile face (`₦4.2M` — the full form wraps at
 * 375px and turns a stat card into three lines) with the exact figure in the hint beneath
 * or in the `title` attribute, so nothing is only ever shown rounded.
 *
 * The last three tiles invert their delta colouring via `higherIsBetter={false}`: a
 * growing backlog, growing pay-on-delivery exposure and growing cancellations are all bad
 * news, and a green up-arrow on any of them would be a lie told in colour.
 */
export function SummaryCards({ summary }: SummaryCardsProps) {
  const { current, previous } = summary

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <MetricCard
        label="Gross revenue"
        value={formatNairaCompact(current.grossRevenue)}
        icon={Coins}
        current={current.grossRevenue}
        previous={previous.grossRevenue}
        hint={`${formatNaira(current.grossRevenue)} · ${formatNairaCompact(current.collectedRevenue)} collected`}
      />
      <MetricCard
        label="Orders"
        value={formatNumber(current.orderCount)}
        icon={ClipboardList}
        current={current.orderCount}
        previous={previous.orderCount}
        hint="Excludes cancelled and unpaid checkouts"
      />
      <MetricCard
        label="Average order value"
        value={formatNairaCompact(current.averageOrderValue)}
        icon={Wallet}
        current={current.averageOrderValue}
        previous={previous.averageOrderValue}
        hint={formatNaira(current.averageOrderValue)}
      />
      <MetricCard
        label="Units sold"
        value={formatNumber(current.unitsSold)}
        icon={Package}
        current={current.unitsSold}
        previous={previous.unitsSold}
        hint="Across mixed units of measure"
      />
      <MetricCard
        label="Buying companies"
        value={formatNumber(current.activeBuyingCompanies)}
        icon={Building2}
        current={current.activeBuyingCompanies}
        previous={previous.activeBuyingCompanies}
        hint="Placed at least one order in this period"
      />
      <MetricCard
        label="New companies"
        value={formatNumber(current.newBuyingCompanies)}
        icon={Sparkles}
        current={current.newBuyingCompanies}
        previous={previous.newBuyingCompanies}
        hint="First ever order landed in this period"
      />
      <MetricCard
        label="Repeat order rate"
        value={formatShare(current.repeatOrderRate)}
        icon={Repeat}
        current={current.repeatOrderRate}
        previous={previous.repeatOrderRate}
        hint="Orders from companies that had bought before"
      />
      <MetricCard
        label="Awaiting delivery"
        value={formatNairaCompact(current.outstandingOrderValue)}
        icon={Truck}
        current={current.outstandingOrderValue}
        previous={previous.outstandingOrderValue}
        higherIsBetter={false}
        variant={current.outstandingOrderCount > 0 ? 'warning' : 'default'}
        hint={`${formatNumber(current.outstandingOrderCount)} order${
          current.outstandingOrderCount === 1 ? '' : 's'
        } not yet delivered`}
      />
      <MetricCard
        label="Pay-on-delivery exposure"
        value={formatNairaCompact(current.payOnDeliveryExposure)}
        icon={HandCoins}
        current={current.payOnDeliveryExposure}
        previous={previous.payOnDeliveryExposure}
        higherIsBetter={false}
        variant={current.payOnDeliveryOrderCount > 0 ? 'warning' : 'default'}
        hint={`${formatNumber(current.payOnDeliveryOrderCount)} order${
          current.payOnDeliveryOrderCount === 1 ? '' : 's'
        } placed on credit, cash not yet reconciled`}
      />
      <MetricCard
        label="Cancelled"
        value={formatNairaCompact(current.cancelledOrderValue)}
        icon={Ban}
        current={current.cancelledOrderValue}
        previous={previous.cancelledOrderValue}
        higherIsBetter={false}
        hint={`${formatNumber(current.cancelledOrderCount)} cancelled · ${formatNumber(
          current.abandonedCheckoutCount,
        )} checkout${current.abandonedCheckoutCount === 1 ? '' : 's'} abandoned`}
      />
    </div>
  )
}
