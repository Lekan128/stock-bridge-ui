import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { api } from '@/api/client'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { SavedDataNote } from '@/components/SavedDataNote'
import { Skeleton } from '@/components/Skeleton'
import { DateRangeControl } from '@/components/analytics/DateRangeControl'
import { defaultDateRange, toApiDateTime, type DateRange } from '@/components/analytics/dateRange'
import { formatCurrency, formatDateRange, formatNumber } from '@/components/analytics/formatters'
import { useApiQuery } from '@/data/useApiQuery'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { viewingBranchId } from '@/features/branches/viewingBranch'

type Grouping = 'kind' | 'branch' | 'person' | 'month'

interface KindFigures {
  units: number
  cost: number
  entries: number
}

interface Figures {
  units: number
  cost: number
  costUnknown: number
  byKind: Record<string, KindFigures>
}

interface LossesReport {
  from: string
  to: string
  groupBy: Grouping
  rows: { key: string; label: string; figures: Figures }[]
  totals: Figures
}

/** The server's kinds, in a shopkeeper's words (`LossesService.KIND_LABELS`). */
const KIND_LABEL: Record<string, string> = {
  MISSING_IN_TRANSIT: 'missing on the way',
  DAMAGED_IN_TRANSIT: 'damaged on the way',
  COUNTED_SHORT: 'counted short',
  COUNTED_OVER: 'counted over',
  DAMAGED: 'damaged',
  EXPIRED: 'expired',
  LOST: 'lost or stolen',
}

/** "2 missing on the way · 1 expired" - what a row is made of. */
function breakdown(figures: Figures): string {
  return Object.entries(figures.byKind)
    .map(([kind, value]) => `${formatNumber(value.units)} ${KIND_LABEL[kind] ?? kind.toLowerCase()}`)
    .join(' · ')
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

/**
 * Losses (MULTI_BRANCH_UX_PLAN.md §5.7, Phase 3): stock that left the books without being sold or used -
 * missing or damaged on the way between branches, counted short (or over), damaged, expired, lost - at
 * what it cost, by kind, branch, person or month. "Shrinkage by staff" is the By person view. Read
 * from the ledger, so it agrees with Stock movements.
 */
export function LossesPage() {
  const branch = useOptionalWorkingBranch()
  // By branch: only in "All branches" of a multi-branch company (rule 1; at a branch it is one row).
  const byBranch = (branch?.isMultiBranch ?? false) && (branch?.isAll ?? false)
  const groupings: { value: Grouping; label: string }[] = [
    { value: 'kind', label: 'By kind' },
    ...(byBranch ? [{ value: 'branch' as const, label: 'By branch' }] : []),
    { value: 'person', label: 'By person' },
    { value: 'month', label: 'By month' },
  ]
  const [range, setRange] = useState<DateRange>(defaultDateRange)
  const [grouping, setGrouping] = useState<Grouping>('kind')
  const shown = groupings.some((option) => option.value === grouping) ? grouping : 'kind'
  const from = toApiDateTime(range.from)
  const to = toApiDateTime(range.to)
  const { data, loading, error, refetch, showingSaved, updatedAt } = useApiQuery<LossesReport>({
    queryKey: ['losses', from, to, shown],
    queryFn: () =>
      api.get<LossesReport>('/api/stock/losses', { params: { from, to, groupBy: shown, branchId: viewingBranchId() } }).then((r) => r.data),
    fallbackError: "Couldn't load the losses report.",
  })
  const totals = data?.totals
  const gains = totals?.byKind.COUNTED_OVER

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Losses</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">
            Stock that left without being sold or used, at what it cost. Every entry is on{' '}
            <Link to="/app/stock-movements" className="font-medium text-primary-700 hover:underline">
              Stock movements
            </Link>{' '}
            too.
          </p>
        </div>
        <DateRangeControl value={range} onChange={setRange} />
      </div>

      <SavedDataNote showing={showingSaved} updatedAt={updatedAt} subject="this report" onRetry={refetch} />

      {totals && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4" data-losses-total>
          <p className="text-sm text-neutral-600">{formatDateRange(range.from, range.to)}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
            {formatCurrency(totals.cost)} <span className="text-base font-normal text-neutral-600">lost · {formatNumber(totals.units)} units</span>
          </p>
          {Object.keys(totals.byKind).length > 0 && <p className="mt-1 text-sm text-neutral-700">{breakdown(totals)}</p>}
          {gains && gains.units > 0 && (
            <p className="mt-1 text-xs text-neutral-500">
              Counts that found more than the books said ({formatNumber(gains.units)}) are taken off the loss.
            </p>
          )}
          {totals.costUnknown > 0 && (
            <p className="mt-1 text-xs text-neutral-500">
              {formatNumber(totals.costUnknown)} {totals.costUnknown === 1 ? 'entry has' : 'entries have'} no cost, so the money leaves
              {totals.costUnknown === 1 ? ' it' : ' them'} out.
            </p>
          )}
        </div>
      )}

      <div role="tablist" aria-label="Group losses" className="flex flex-wrap gap-1 self-start rounded-md border border-neutral-200 bg-neutral-50 p-0.5">
        {groupings.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={shown === option.value}
            onClick={() => setGrouping(option.value)}
            className={`min-h-11 rounded px-3 text-sm font-medium ${
              shown === option.value ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading && <Skeleton className="h-40 w-full" />}
      {!loading && error && <ErrorState title="Couldn't load losses" message={error} onRetry={refetch} />}
      {!loading && !error && data && data.rows.length === 0 && (
        <EmptyState icon={ShieldCheck} title="Nothing lost in this period" description="No missing, damaged, expired or lost stock, and every count matched the books." />
      )}
      {!loading && !error && data && data.rows.length > 0 && (
        <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white" aria-label="Losses">
          {data.rows.map((row) => (
            <li key={row.key} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-neutral-900">{shown === 'month' ? monthLabel(row.key) : row.label}</p>
                {shown !== 'kind' && <p className="text-sm text-neutral-600">{breakdown(row.figures)}</p>}
              </div>
              <div className="shrink-0 text-right tabular-nums">
                <p className="font-semibold text-neutral-900">{formatCurrency(row.figures.cost)}</p>
                <p className="text-xs text-neutral-500">{formatNumber(row.figures.units)} units</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
