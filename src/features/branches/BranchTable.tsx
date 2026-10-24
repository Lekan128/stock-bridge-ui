import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { api } from '@/api/client'
import { ErrorState } from '@/components/ErrorState'
import { SavedDataNote } from '@/components/SavedDataNote'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/components/useToast'
import { useApiQuery } from '@/data/useApiQuery'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useWorkingBranch } from '@/features/branches/useWorkingBranch'
import { formatNairaCompact } from '@/utils/money'

/** `GET /api/analytics/branches` (MULTI_BRANCH_BUILD_PLAN.md §6). Absent fields are `== null`. */
export interface BranchTableRow {
  branchId: string
  name: string
  main: boolean
  stockWorth: number
  productsWithoutCost: number
  productsInStock: number
  activeProducts: number
  low: number
  out: number
  onTheWayIn: number
  onTheWayOut: number
  missing: number
  salesToday: number
  lastCountAt?: string
  phonesSeen: number
  waiting: number
  needsYou: number
  oldestWaitingAt?: string
  phonesLastSeenAt?: string
}

interface BranchTableData {
  rows: BranchTableRow[]
  totals: { stockWorth: number; low: number; out: number; onTheWay: number; missing: number; salesToday: number; waiting: number; needsYou: number }
  asOf: string
}

type SortKey = 'name' | 'stockWorth' | 'lowOut' | 'onTheWay' | 'missing' | 'salesToday' | 'lastCount' | 'phones'

const DAY = 24 * 60 * 60 * 1000

/** "Mon" this week, "12 days" before that, "Never". */
function lastCountText(at: string | undefined): string {
  if (!at) return 'Never'
  const days = Math.floor((Date.now() - new Date(at).getTime()) / DAY)
  if (days < 1) return 'Today'
  if (days < 7) return new Date(at).toLocaleDateString(undefined, { weekday: 'short' })
  return `${days} days`
}

/** What a branch's phones still hold (UX §5.8): the owner reads a stale figure as true without it. */
function phonesText(row: BranchTableRow): { text: string; tone: 'ok' | 'warn' | 'quiet' } {
  if (row.phonesSeen === 0) return { text: 'No phone this week', tone: 'quiet' }
  if (row.needsYou > 0) return { text: `${row.needsYou} need${row.needsYou === 1 ? 's' : ''} you`, tone: 'warn' }
  if (row.waiting > 0) return { text: `${row.waiting} waiting`, tone: 'warn' }
  return { text: 'All sent', tone: 'ok' }
}

function onTheWayText(row: BranchTableRow): string {
  const parts = [row.onTheWayOut > 0 ? `${row.onTheWayOut} out` : null, row.onTheWayIn > 0 ? `${row.onTheWayIn} in` : null].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : '—'
}

function sortValue(row: BranchTableRow, key: SortKey): number | string {
  switch (key) {
    case 'name':
      return row.name.toLowerCase()
    case 'stockWorth':
      return row.stockWorth
    case 'lowOut':
      return row.low + row.out
    case 'onTheWay':
      return row.onTheWayIn + row.onTheWayOut
    case 'missing':
      return row.missing
    case 'salesToday':
      return row.salesToday
    case 'lastCount':
      return row.lastCountAt ? -new Date(row.lastCountAt).getTime() : Number.NEGATIVE_INFINITY
    case 'phones':
      return row.needsYou * 1000 + row.waiting
  }
}

/**
 * The owner's combined view (MULTI_BRANCH_UX_PLAN.md §5.8): in "All branches" the dashboard is one row
 * per branch, then the company - a real table on a laptop (sortable, numbers right-aligned), one card
 * per branch on a phone with the same numbers in the same order. Every figure opens its screen at that
 * branch, and says so (rule 4: the branch never changes without saying so).
 */
export function BranchTable() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { choose } = useWorkingBranch()
  // Null until a header is chosen: the server's order, main branch first.
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null)
  const { data, loading, error, refetch, showingSaved, updatedAt } = useApiQuery<BranchTableData>({
    queryKey: ['analytics', 'branches'],
    queryFn: () => api.get<BranchTableData>('/api/analytics/branches').then((r) => r.data),
    fallbackError: "Couldn't load your branches' figures.",
  })

  function openAt(row: BranchTableRow, path: string) {
    choose(row.branchId)
    showToast(`Opened at ${row.name}.`, 'info')
    navigate(path)
  }

  if (loading) {
    return (
      <section aria-busy="true" className="flex flex-col gap-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-40 w-full" />
      </section>
    )
  }
  if (error || !data) return <ErrorState title="Couldn't load your branches" message={error ?? ''} onRetry={refetch} />

  const rows = sort
    ? [...data.rows].sort((a, b) => {
        const left = sortValue(a, sort.key)
        const right = sortValue(b, sort.key)
        const order = left < right ? -1 : left > right ? 1 : 0
        return sort.direction === 'asc' ? order : -order
      })
    : data.rows

  function header(key: SortKey, label: string, align: 'left' | 'right' = 'right') {
    const active = sort?.key === key
    return (
      <th
        scope="col"
        aria-sort={active ? (sort?.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={`px-3 py-2.5 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}
      >
        <button
          type="button"
          onClick={() =>
            // The same header flips the order; a new one starts A-Z for names, biggest first for figures.
            setSort((current) =>
              current?.key === key
                ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
                : { key, direction: key === 'name' ? 'asc' : 'desc' },
            )
          }
          className="inline-flex min-h-11 items-center gap-1 rounded-sm hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          {label}
          {active && (sort?.direction === 'asc' ? <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />)}
        </button>
      </th>
    )
  }

  const cell = (row: BranchTableRow, path: string, content: React.ReactNode, label: string, tone = 'text-neutral-900') => (
    <button
      type="button"
      onClick={() => openAt(row, path)}
      aria-label={`${label} at ${row.name}`}
      className={`rounded-sm tabular-nums hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${tone}`}
    >
      {content}
    </button>
  )

  return (
    <section aria-labelledby="branch-table-heading" className="flex flex-col gap-3" data-branch-table>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="branch-table-heading" className="text-base font-semibold text-neutral-900">
          Your branches
        </h2>
        <p className="text-xs text-neutral-500">Tap a figure to open it at that branch.</p>
      </div>
      <SavedDataNote showing={showingSaved} updatedAt={updatedAt} subject="these figures" onRetry={refetch} />

      {/* Laptop: the table. */}
      <div className="hidden overflow-x-auto rounded-lg border border-neutral-200 bg-white md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
            <tr>
              {header('name', 'Branch', 'left')}
              {header('stockWorth', 'Stock worth')}
              {header('lowOut', 'Low · Out')}
              {header('onTheWay', 'On the way')}
              {header('missing', 'Missing')}
              {header('salesToday', 'Sales today')}
              {header('lastCount', 'Last count')}
              {header('phones', 'Phones')}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((row) => {
              const phones = phonesText(row)
              return (
                <tr key={row.branchId}>
                  <th scope="row" className="px-3 py-2.5 text-left font-medium">
                    {cell(row, '/app', row.name, 'Dashboard')}
                  </th>
                  <td className="px-3 py-2.5 text-right">
                    {cell(row, '/app/products', formatNairaCompact(row.stockWorth), 'Stock worth')}
                    <span className="block text-xs text-neutral-500">{row.productsInStock.toLocaleString()} of {row.activeProducts.toLocaleString()} products</span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {cell(row, '/app/products?stockStatus=LOW', `${row.low} · ${row.out}`, 'Low and out of stock',
                      row.out > 0 ? 'text-danger-700' : row.low > 0 ? 'text-warning-800' : 'text-neutral-900')}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {row.onTheWayIn + row.onTheWayOut > 0 ? cell(row, '/app/transfers', onTheWayText(row), 'On the way') : <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {row.missing > 0 ? cell(row, '/app/transfers?tab=all', row.missing.toLocaleString(), 'Missing', 'text-warning-800') : <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">{cell(row, '/app/sales', formatNairaCompact(row.salesToday), 'Sales today')}</td>
                  <td className="px-3 py-2.5 text-right">{cell(row, '/app/stock-movements', lastCountText(row.lastCountAt), 'Last count')}</td>
                  <td className={`px-3 py-2.5 text-right ${phones.tone === 'warn' ? 'text-warning-800' : phones.tone === 'quiet' ? 'text-neutral-500' : 'text-neutral-900'}`}>
                    {phones.text}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="border-t border-neutral-200 bg-neutral-50 font-semibold">
            <tr>
              <th scope="row" className="px-3 py-2.5 text-left">All</th>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatNairaCompact(data.totals.stockWorth)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{data.totals.low} · {data.totals.out}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{data.totals.onTheWay || '—'}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{data.totals.missing || '—'}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatNairaCompact(data.totals.salesToday)}</td>
              <td />
              <td className="px-3 py-2.5 text-right tabular-nums">{data.totals.waiting + data.totals.needsYou > 0 ? `${data.totals.waiting + data.totals.needsYou} waiting` : ''}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Phone: one card per branch, the same figures in the same order. */}
      <ul className="flex flex-col gap-2 md:hidden" aria-label="Your branches">
        {rows.map((row) => {
          const phones = phonesText(row)
          const facts: [string, React.ReactNode][] = [
            ['Stock worth', cell(row, '/app/products', formatNairaCompact(row.stockWorth), 'Stock worth')],
            ['Low · Out', cell(row, '/app/products?stockStatus=LOW', `${row.low} · ${row.out}`, 'Low and out of stock',
              row.out > 0 ? 'text-danger-700' : row.low > 0 ? 'text-warning-800' : 'text-neutral-900')],
            ['On the way', row.onTheWayIn + row.onTheWayOut > 0 ? cell(row, '/app/transfers', onTheWayText(row), 'On the way') : '—'],
            ['Missing', row.missing > 0 ? cell(row, '/app/transfers?tab=all', row.missing.toLocaleString(), 'Missing', 'text-warning-800') : '—'],
            ['Sales today', cell(row, '/app/sales', formatNairaCompact(row.salesToday), 'Sales today')],
            ['Last count', cell(row, '/app/stock-movements', lastCountText(row.lastCountAt), 'Last count')],
            ['Phones', <span key="p" className={phones.tone === 'warn' ? 'text-warning-800' : phones.tone === 'quiet' ? 'text-neutral-500' : ''}>{phones.text}</span>],
          ]
          return (
            <li key={row.branchId} className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="text-base font-semibold text-neutral-900">{cell(row, '/app', row.name, 'Dashboard')}</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {facts.map(([label, value]) => (
                  <div key={label} className="flex flex-col">
                    <dt className="text-xs text-neutral-500">{label}</dt>
                    <dd className="tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </li>
          )
        })}
        <li className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm">
          <p className="font-semibold text-neutral-900">All branches</p>
          <p className="mt-1 tabular-nums text-neutral-700">
            {formatNairaCompact(data.totals.stockWorth)} stock · {data.totals.low} low · {data.totals.out} out ·{' '}
            {formatNairaCompact(data.totals.salesToday)} sales today
          </p>
        </li>
      </ul>
      <DigestSwitch />
    </section>
  )
}

/**
 * "Email me this every evening" (MULTI_BRANCH_UX_PLAN.md §5.13): the owner's daily digest, only if they
 * turn it on - one email a day, never a reminder. A setting of this person's own, so online only.
 */
function DigestSwitch() {
  const online = useOnlineStatus()
  const { showToast } = useToast()
  const { data, setData } = useApiQuery<{ enabled: boolean }>({
    queryKey: ['analytics', 'branches', 'digest'],
    queryFn: () => api.get<{ enabled: boolean }>('/api/analytics/branches/digest').then((r) => r.data),
    fallbackError: "Couldn't load your email setting.",
  })
  const [saving, setSaving] = useState(false)
  if (!data) return null

  async function change(enabled: boolean) {
    setSaving(true)
    try {
      setData(await api.put<{ enabled: boolean }>('/api/analytics/branches/digest', { enabled }).then((r) => r.data))
      showToast(enabled ? "You'll get this by email every evening." : 'No more evening emails.', 'success')
    } catch {
      showToast("Couldn't change that. Try again.", 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <label className="flex min-h-11 items-center gap-2 self-start text-sm text-neutral-700">
      <input
        type="checkbox"
        checked={data.enabled}
        disabled={saving || !online}
        onChange={(event) => void change(event.target.checked)}
        className="h-4 w-4 rounded-sm border-neutral-300 accent-primary-600"
      />
      Email me this every evening
    </label>
  )
}
