import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Download } from 'lucide-react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { Button, buttonClassName } from '@/components/Button'
import { DateRangeControl } from '@/components/analytics/DateRangeControl'
import { toApiDateTime, todayRange, type DateRange } from '@/components/analytics/dateRange'
import { formatDateRange } from '@/components/analytics/formatters'
import { EmptyState } from '@/components/EmptyState'
import { useToast } from '@/components/useToast'
import { useApiQuery } from '@/data/useApiQuery'
import { useOutboxState } from '@/features/outbox/useOutbox'
import { formatNumber, stockUnitWord } from '@/features/products/unitCopy'
import { formatMoney } from '@/features/selling/money'
import { SaleDetailSheet } from '@/features/selling/sales/SaleDetailSheet'
import { salesReportApi } from '@/features/selling/sales/salesReportApi'
import type { SalesFilter, SalesGrouping, SalesReport, SalesReportRow, SalesTotals } from '@/features/selling/sales/types'
import { useSellingPolicy } from '@/features/selling/useSellingPolicy'
import { downloadBlob } from '@/utils/downloadBlob'

const TABS: { value: SalesGrouping; label: string }[] = [
  { value: 'sale', label: 'Sales' },
  { value: 'product', label: 'By product' },
  { value: 'day', label: 'By day' },
  { value: 'user', label: 'By person' },
  { value: 'category', label: 'By category' },
]

/** The three an owner checks for leaks (§6.11), each with how many there are. */
const LEAKS: { value: SalesFilter; label: string; count: (totals: SalesTotals) => number }[] = [
  { value: 'belowUsualPrice', label: 'Sold below usual price', count: (t) => t.belowUsualPriceLineCount },
  { value: 'belowCost', label: 'Sold below cost', count: (t) => t.belowCostLineCount },
  { value: 'cancelled', label: 'Cancelled', count: (t) => t.cancelledLineCount },
]

const FIX_LABELS: Partial<Record<SalesFilter, string>> = {
  unpriced: 'Sales with no price',
  noCost: 'Sales with no cost',
}

/**
 * Sales (`SELLING_PRICE_PLAN.md` §6.11) - Inventory → Sales. Today's sales as a list first: the
 * shopkeeper's question at closing time. One figure at the top, what profit leaves out said once in
 * a shopkeeper's words, then the list or a breakdown by product, day or person. Every footer is the
 * server's, and equals the rows above it.
 */
export function SalesPage() {
  const { user } = useAuth()
  const { recordsSales } = useSellingPolicy()
  const { showToast } = useToast()
  const { ops } = useOutboxState()
  const canSell = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.STOCK_OUT)
  const [range, setRange] = useState<DateRange>(todayRange)
  const [tab, setTab] = useState<SalesGrouping>('sale')
  const [filter, setFilter] = useState<SalesFilter | null>(null)
  const [openSale, setOpenSale] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const from = toApiDateTime(range.from)
  const to = toApiDateTime(range.to)
  const params = { from, to, groupBy: tab, filter }
  // The unfiltered report too: its totals are the headline and the chips' counts. While no filter is
  // on, it is the same request (and the same cache entry) as the one on screen.
  const base = useApiQuery<SalesReport>({
    queryKey: ['sales-report', from, to, tab, null],
    queryFn: () => salesReportApi.report({ from, to, groupBy: tab }),
    fallbackError: "Couldn't load your sales.",
    enabled: recordsSales,
    keepPrevious: true,
  })
  const shown = useApiQuery<SalesReport>({
    queryKey: ['sales-report', from, to, tab, filter],
    queryFn: () => salesReportApi.report(params),
    fallbackError: "Couldn't load your sales.",
    enabled: recordsSales && filter != null,
    keepPrevious: true,
  })
  const report = filter == null ? base.data : shown.data
  const totals = base.data?.totals
  const loading = filter == null ? base.loading : shown.loading
  const error = (filter == null ? base.error : shown.error) ?? null

  const waiting = new Set(
    ops.flatMap((op) => (op.kind === 'STOCK_OUT' && op.status === 'pending' && op.payload.saleId ? [op.payload.saleId] : [])),
  ).size

  function refresh() {
    base.refetch()
    if (filter) shown.refetch()
  }

  async function exportIt() {
    setExporting(true)
    try {
      downloadBlob(await salesReportApi.export(params), 'sales.xlsx')
    } catch {
      showToast("Couldn't download the sales. Try again.", 'error')
    } finally {
      setExporting(false)
    }
  }

  if (!recordsSales) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-3 py-8">
        <h1 className="text-2xl font-semibold text-neutral-900">Sales</h1>
        <p className="text-sm text-neutral-600">Your company doesn't record sales, so there is nothing to show here.</p>
        <Link to="/app/company" className="text-sm font-medium text-primary-600 hover:underline">
          Selling settings
        </Link>
      </div>
    )
  }

  const left = totals ? totals.unpricedLineCount + totals.unknownCostLineCount : 0
  const isToday = range.preset === 'today'

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Sales</h1>
          <p className="mt-1 text-sm text-neutral-500">{formatDateRange(range.from, range.to)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeControl value={range} onChange={setRange} />
          <Button variant="secondary" onClick={() => void exportIt()} loading={exporting}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Export
          </Button>
        </div>
      </div>

      {/* One figure; everything else on the page explains it. */}
      {totals && (
        <section aria-label="Sales total" className="flex flex-col gap-1">
          <p className="text-3xl font-semibold tabular-nums text-neutral-900" data-sales-total>
            {formatMoney(totals.salesAmount)}
          </p>
          <p className="text-sm text-neutral-600 tabular-nums">
            {formatNumber(totals.saleCount)} {totals.saleCount === 1 ? 'sale' : 'sales'}
            {(totals.profitKnownSalesAmount ?? 0) > 0 && totals.grossProfit != null && (
              <>
                {' · '}
                {formatMoney(totals.grossProfit)} profit
                {totals.margin != null && ` (${percent(totals.margin)})`}
              </>
            )}
          </p>
          {left > 0 && (
            <p className="text-sm text-neutral-600">
              Profit leaves out {formatNumber(left)} {left === 1 ? 'sale' : 'sales'}:{' '}
              {[
                totals.unpricedLineCount > 0 && `${formatNumber(totals.unpricedLineCount)} ${totals.unpricedLineCount === 1 ? 'has' : 'have'} no price`,
                totals.unknownCostLineCount > 0 && `${formatNumber(totals.unknownCostLineCount)} ${totals.unknownCostLineCount === 1 ? 'has' : 'have'} no cost`,
              ]
                .filter(Boolean)
                .join(' and ')}
              .{' '}
              <button
                type="button"
                onClick={() => {
                  setTab('sale')
                  setFilter(totals.unpricedLineCount > 0 ? 'unpriced' : 'noCost')
                }}
                className="rounded-sm font-medium text-primary-700 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                Fix these
              </button>
            </p>
          )}
          {waiting > 0 && (
            <p className="text-xs text-neutral-500">
              {waiting} {waiting === 1 ? 'sale is' : 'sales are'} saved on this phone, waiting to send. {waiting === 1 ? 'It shows' : 'They show'} here once sent.
            </p>
          )}
        </section>
      )}

      <div role="tablist" aria-label="Show sales" className="flex gap-1 self-start overflow-x-auto rounded-md border border-neutral-200 bg-neutral-50 p-0.5">
        {TABS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={tab === option.value}
            onClick={() => setTab(option.value)}
            className={`rounded-sm px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
              tab === option.value ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div role="group" aria-label="Show only" className="flex flex-wrap items-center gap-2">
        {LEAKS.map((leak) => {
          const count = totals ? leak.count(totals) : 0
          const on = filter === leak.value
          return (
            <button
              key={leak.value}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(on ? null : leak.value)}
              className={`rounded-full border px-3 py-1 text-sm ${
                on ? 'border-primary-300 bg-primary-50 font-medium text-primary-800' : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              {leak.label} <span className="tabular-nums text-neutral-500">{formatNumber(count)}</span>
            </button>
          )
        })}
        {filter && FIX_LABELS[filter] && (
          <span className="inline-flex items-center gap-2 rounded-full border border-primary-300 bg-primary-50 px-3 py-1 text-sm font-medium text-primary-800">
            {FIX_LABELS[filter]}
            <button type="button" onClick={() => setFilter(null)} aria-label="Show all sales" className="text-primary-700">
              ✕
            </button>
          </span>
        )}
      </div>

      {error && !report && <p className="text-sm text-danger-700">{error}</p>}
      {loading && !report && <p className="text-sm text-neutral-500">Loading…</p>}

      {report && report.rows.length === 0 && (
        isToday && filter == null && tab === 'sale' ? (
          <EmptyState
            title="No sales yet today"
            description="Sales you record with Sell show up here."
            action={
              canSell ? (
                <Link to="/app/sell" className={buttonClassName('action')}>
                  Record a sale
                </Link>
              ) : undefined
            }
          />
        ) : (
          <p className="rounded-lg border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-600">
            Nothing here for these dates{filter ? ' and this filter' : ''}.
          </p>
        )
      )}

      {report && report.rows.length > 0 && tab === 'sale' && (
        <ul aria-label="Sales" className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
          {report.rows.map((row) => (
            <SaleRow key={row.key ?? row.occurredAt} row={row} withDate={!isToday} onOpen={() => row.key && setOpenSale(row.key)} />
          ))}
        </ul>
      )}

      {report && report.rows.length > 0 && tab !== 'sale' && <BreakdownTable report={report} tab={tab} />}

      {report?.truncated && (
        <p className="text-xs text-neutral-500">Only the first {formatNumber(report.rows.length)} rows are listed. The total covers them all.</p>
      )}

      <SaleDetailSheet saleId={openSale} onClose={() => setOpenSale(null)} onChanged={refresh} />
    </div>
  )
}

function SaleRow({ row, withDate, onOpen }: { row: SalesReportRow; withDate: boolean; onOpen: () => void }) {
  const t = row.totals
  const allCancelled = t.lineCount === 0 && t.cancelledLineCount > 0
  const time = row.occurredAt
    ? new Date(row.occurredAt).toLocaleString(undefined, withDate ? { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' } : { hour: 'numeric', minute: '2-digit' })
    : ''
  const notes = [
    t.unpricedLineCount > 0 && t.unpricedLineCount < t.lineCount && `${t.unpricedLineCount} without a price`,
    t.cancelledLineCount > 0 && !allCancelled && `${t.cancelledLineCount} cancelled`,
    t.belowUsualPriceLineCount > 0 && 'below usual price',
  ].filter(Boolean)
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
      >
        <span className={`min-w-0 ${allCancelled ? 'text-neutral-500 line-through' : ''}`}>
          <span className="block truncate text-sm font-medium text-neutral-900">{row.detail ?? 'Sale'}</span>
          <span className="block truncate text-sm text-neutral-600 tabular-nums">
            {time}
            {row.label && ` · ${row.label}`}
            {notes.length > 0 && <span className="text-warning-700"> · {notes.join(' · ')}</span>}
          </span>
        </span>
        <span className={`shrink-0 text-base font-semibold tabular-nums ${allCancelled ? 'text-neutral-500 line-through' : 'text-neutral-900'}`}>
          {allCancelled ? 'Cancelled' : t.unpricedLineCount === t.lineCount ? <span className="text-sm font-medium text-warning-700">No price</span> : formatMoney(t.salesAmount)}
        </span>
      </button>
    </li>
  )
}

function BreakdownTable({ report, tab }: { report: SalesReport; tab: SalesGrouping }) {
  const first = tab === 'product' ? 'Product' : tab === 'day' ? 'Day' : tab === 'category' ? 'Category' : 'Person'
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
      <table className="w-full min-w-[36rem] text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-medium text-neutral-600">
          <tr>
            <th scope="col" className="px-4 py-2.5">{first}</th>
            <th scope="col" className="px-4 py-2.5 text-right">{tab === 'product' ? 'Sold' : 'Sales'}</th>
            <th scope="col" className="px-4 py-2.5 text-right">Sales (₦)</th>
            <th scope="col" className="px-4 py-2.5 text-right">Cost</th>
            <th scope="col" className="px-4 py-2.5 text-right">Profit</th>
            <th scope="col" className="px-4 py-2.5 text-right">Margin</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {report.rows.map((row) => (
            <tr key={row.key ?? row.label}>
              <th scope="row" className="px-4 py-2.5 text-left font-medium text-neutral-900">
                {tab === 'day' && row.label
                  ? dayLabel(row.label)
                  : (row.label ?? (tab === 'category' ? 'No category' : 'Not recorded'))}
              </th>
              <td className="px-4 py-2.5 text-right tabular-nums text-neutral-700">
                {tab === 'product'
                  ? `${formatNumber(row.quantity ?? 0)} ${row.unitOfMeasure ? stockUnitWord(row.unitOfMeasure.toLowerCase(), row.quantity ?? 0) : ''}`
                  : formatNumber(row.totals.saleCount)}
              </td>
              <MoneyCells totals={row.totals} />
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-neutral-200 font-semibold">
          <tr>
            <th scope="row" className="px-4 py-2.5 text-left text-neutral-900">Total</th>
            <td className="px-4 py-2.5 text-right tabular-nums text-neutral-700">
              {tab === 'product' ? '' : formatNumber(report.totals.saleCount)}
            </td>
            <MoneyCells totals={report.totals} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function MoneyCells({ totals }: { totals: SalesTotals }) {
  const known = (totals.profitKnownSalesAmount ?? 0) > 0
  return (
    <>
      <td className="px-4 py-2.5 text-right tabular-nums text-neutral-900">{formatMoney(totals.salesAmount)}</td>
      <td className="px-4 py-2.5 text-right tabular-nums text-neutral-700">{known && totals.costAmount != null ? formatMoney(totals.costAmount) : '—'}</td>
      <td className={`px-4 py-2.5 text-right tabular-nums ${(totals.grossProfit ?? 0) < 0 ? 'text-danger-700' : 'text-neutral-900'}`}>
        {known && totals.grossProfit != null ? formatMoney(totals.grossProfit) : '—'}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums text-neutral-700">{totals.margin != null ? percent(totals.margin) : '—'}</td>
    </>
  )
}

function percent(margin: number): string {
  return `${Math.round(margin * 1000) / 10}%`
}

/** "2026-10-19" → "Mon 19 Oct" - the day as the report groups it (Lagos). */
function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}
