import { useState } from 'react'
import { MoneyInput } from '@/features/selling/MoneyInput'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/Button'
import { useApiQuery } from '@/data/useApiQuery'
import { isAppError } from '@/types/api'
import { useAuth } from '@/auth/useAuth'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { useWorkArea } from '@/features/branches/workArea'
import { formatMoney } from '@/features/selling/money'
import { cashDayApi, moneyTyped, type CloseResult, type Drawer } from '@/features/selling/sale/cashDay'

const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

/**
 * Close the day (Step 13; owner, 2026-11-18). One drawer at a time: which one (when this person closes more than one),
 * a blind count of its cash, then what they counted - over or short only for someone who sees sales profit - and the
 * next thing to do: the next drawer, or Log out.
 */
export function CloseDayPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { logout } = useAuth()
  const branchHere = useOptionalWorkingBranch()
  const branch = branchHere && !branchHere.isAll ? (branchHere.working ?? branchHere.branches[0] ?? null) : null
  const work = useWorkArea(branch)
  const mine = (drawer: Drawer) => !drawer.areaId || work.areas.length === 0 || work.areas.some((area) => area.id === drawer.areaId)

  const drawers = useApiQuery<Drawer[]>({
    queryKey: ['cash-today', branch?.id ?? null],
    queryFn: () => cashDayApi.today(branch!.id),
    fallbackError: "Couldn't load the drawers.",
    enabled: !!branch,
  })
  // One row per drawer: a drawer opened again after a close is the same drawer - show only its latest state.
  const list = Object.values(
    (drawers.data ?? []).filter(mine).reduce<Record<string, Drawer>>((latest, drawer) => {
      const key = drawer.areaId ?? 'branch'
      const kept = latest[key]
      if (!kept || (kept.closed && (!drawer.closed || (drawer.closedAt ?? '') > (kept.closedAt ?? '')))) latest[key] = drawer
      return latest
    }, {}),
  )
  const [counting, setCounting] = useState<{ drawer: Drawer; again: boolean } | null>(null)
  const [result, setResult] = useState<CloseResult | null>(null)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const open = list.filter((drawer) => !drawer.closed)
  // One drawer to close and nothing else: straight to its count.
  const only = !counting && !result && open.length === 1 && list.length === 1 ? open[0] : null
  const current = counting ?? (only ? { drawer: only, again: false } : null)

  async function submit() {
    const value = moneyTyped(amount)
    if (!current || value == null) return
    setBusy(true)
    setProblem(null)
    try {
      const done = current.again ? await cashDayApi.countAgain(current.drawer.id, value) : await cashDayApi.close(current.drawer.id, value)
      setResult(done)
      setCounting(null)
      setAmount('')
      await queryClient.invalidateQueries({ queryKey: ['cash-today'] })
      await queryClient.invalidateQueries({ queryKey: ['cash-till'] })
    } catch (error) {
      setProblem(isAppError(error) ? error.message : "Couldn't close it. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const back = (
    <button type="button" onClick={() => (counting ? setCounting(null) : navigate('/app/sell'))} aria-label="Back" className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100">
      <ArrowLeft className="h-5 w-5" aria-hidden="true" />
    </button>
  )

  // ------------------------------------------------------------- closed: what they counted, and what next
  if (result && !counting) {
    const place = result.drawer.areaName ?? branch?.name ?? 'Drawer'
    const next = open.find((drawer) => drawer.id !== result.drawer.id)
    const short = result.difference != null && result.difference < 0
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4" data-day-closed>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => (list.length > 1 ? setResult(null) : navigate('/app/sell'))}
            aria-label={list.length > 1 ? 'Back to the drawers' : 'Back to Record a sale'}
            className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <h1 className="text-xl font-semibold text-neutral-900 lg:text-2xl">{place} closed</h1>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-accent-50 px-4 py-3 font-semibold text-accent-700 tabular-nums">
          <span className="inline-flex items-center gap-2">
            <Check className="h-5 w-5" aria-hidden="true" />
            Closed {result.drawer.closedAt ? time(result.drawer.closedAt) : ''}
          </span>
          <span>{formatMoney(result.drawer.counted ?? 0)} counted</span>
        </div>
        {result.drawer.mayCountAgain && (
          <button type="button" onClick={() => setCounting({ drawer: result.drawer, again: true })} className="self-start text-sm font-medium text-primary-700 hover:underline">
            Made a mistake? Count again
          </button>
        )}
        <dl className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white text-sm tabular-nums">
          <div className="flex justify-between px-4 py-2.5">
            <dt className="text-neutral-600">Sales</dt>
            <dd className="font-semibold text-neutral-900">
              {result.salesCount} · {formatMoney(result.salesAmount)}
            </dd>
          </div>
          {/* The owner's figures: only for someone who sees sales profit. */}
          {result.expected != null && (
            <>
              <div className="flex justify-between px-4 py-2.5">
                <dt className="text-neutral-600">Cash should be</dt>
                <dd className="font-semibold text-neutral-900">{formatMoney(result.expected)}</dd>
              </div>
              <div className={`flex justify-between px-4 py-2.5 font-semibold ${short ? 'text-danger-700' : 'text-accent-700'}`}>
                <dt>{result.difference === 0 ? 'Matched' : short ? 'Short' : 'Over'}</dt>
                <dd>{formatMoney(Math.abs(result.difference ?? 0))}</dd>
              </div>
              <div className="px-4 py-2.5 text-xs text-neutral-500">
                {result.floatSkipped ? 'No starting cash' : `${formatMoney(result.floatAmount ?? 0)} to start`} + {formatMoney(result.cashSales ?? 0)} cash sales
                {(result.moneyOut ?? 0) > 0 ? ` − ${formatMoney(result.moneyOut ?? 0)} taken out` : ''}
              </div>
              {(result.otherPayments ?? []).map((other) => (
                <div key={other.label} className="flex justify-between px-4 py-2.5">
                  <dt className="text-neutral-600">{other.label}</dt>
                  <dd className="text-neutral-900">{formatMoney(other.amount)}</dd>
                </div>
              ))}
            </>
          )}
        </dl>
        {result.expected == null && <p className="text-sm text-neutral-500">The owner gets the figures.</p>}
        {next ? (
          <Button variant="action" className="min-h-12" onClick={() => setCounting({ drawer: next, again: false })}>
            Count the {next.areaName ?? 'next'} next
          </Button>
        ) : (
          <div className="flex flex-col gap-2">
            <Button variant="action" className="min-h-12" onClick={() => void logout()}>
              Log out
            </Button>
            <Link to="/app/sell" className="self-center text-sm font-medium text-neutral-600 hover:underline">
              Back to Record a sale
            </Link>
          </div>
        )}
      </div>
    )
  }

  // ------------------------------------------------------------- counting one drawer, blind
  if (current) {
    const place = current.drawer.areaName ?? branch?.name ?? 'your'
    return (
      <form
        className="mx-auto flex w-full max-w-md flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <div className="flex items-center gap-2">
          {back}
          <h1 className="text-xl font-semibold text-neutral-900 lg:text-2xl">{current.again ? `Count the ${place} again` : `Close the ${place}`}</h1>
        </div>
        <div>
          <label htmlFor="close-count" className="mb-1.5 block text-base font-semibold text-neutral-900">
            Count the cash in the {place} drawer
          </label>
          <MoneyInput
            id="close-count"
            whole
            autoFocus
            placeholder="₦0"
            value={amount}
            onValue={setAmount}
            className="h-14 w-full rounded-md border-2 border-neutral-300 px-3 text-2xl font-semibold tabular-nums focus:border-primary-600 focus:outline-none"
          />
          <p className="mt-1.5 text-sm text-neutral-500">Count the notes and coins in it now. Only what's in this drawer.</p>
        </div>
        {problem && (
          <p role="alert" className="text-sm text-danger-700">
            {problem}
          </p>
        )}
        <Button type="submit" variant="action" loading={busy} disabled={moneyTyped(amount) == null} className="min-h-12">
          {current.again ? 'Save the count' : 'Close the day'}
        </Button>
      </form>
    )
  }

  // ------------------------------------------------------------- which drawer
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="flex items-center gap-2">
        {back}
        <h1 className="text-xl font-semibold text-neutral-900 lg:text-2xl">Close the day</h1>
      </div>
      {drawers.error && <p role="alert" className="text-sm text-danger-700">{drawers.error}</p>}
      {drawers.data && list.length === 0 && <p className="text-sm text-neutral-600">No drawer is open here today.</p>}
      {list.length > 0 && (
        <>
          <p className="text-sm font-semibold text-neutral-900">Which drawer are you counting?</p>
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200 bg-white" aria-label="Drawers">
            {list.map((drawer) => (
              <li key={drawer.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${drawer.closed ? 'bg-neutral-50' : ''}`}>
                <span className="min-w-0">
                  <span className={`block font-semibold ${drawer.closed ? 'text-neutral-500' : 'text-neutral-900'}`}>{drawer.areaName ?? branch?.name}</span>
                  <span className="block text-sm text-neutral-500 tabular-nums">
                    {drawer.closed
                      ? `✓ Counted ${drawer.closedAt ? time(drawer.closedAt) : ''} · ${formatMoney(drawer.counted ?? 0)}`
                      : `Open since ${time(drawer.openedAt)} · ${drawer.salesCount} ${drawer.salesCount === 1 ? 'sale' : 'sales'}`}
                  </span>
                  {drawer.closed && drawer.mayCountAgain && (
                    <button type="button" onClick={() => setCounting({ drawer, again: true })} className="text-sm font-medium text-primary-700 hover:underline">
                      Count again
                    </button>
                  )}
                </span>
                {drawer.closed ? (
                  <Button variant="secondary" onClick={() => void cashDayApi.get(drawer.id).then(setResult)}>
                    See
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => setCounting({ drawer, again: false })}>
                    Count
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {open.length > 1 && <p className="text-sm text-neutral-600">Count each drawer's cash apart. Don't put them together before counting.</p>}
        </>
      )}
    </div>
  )
}
