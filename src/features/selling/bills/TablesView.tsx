import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApiQuery } from '@/data/useApiQuery'
import type { Branch } from '@/features/branches/types'
import { formatMoney } from '@/features/selling/money'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { billsApi, openFor, type BillSummary } from '@/features/selling/bills/billsApi'

/** Tables or Counter, per phone: a waiter lives on Tables, a counter on Counter (owner, 2026-11-19). */
export type TillMode = 'tables' | 'counter'
const MODE_KEY = 'till-mode'

export function useTillMode(branch: Branch | null): [TillMode | null, (mode: TillMode) => void] {
  const hasTables = (branch?.tables?.length ?? 0) > 0
  const [mode, setMode] = useState<TillMode>(() => {
    try {
      return localStorage.getItem(MODE_KEY) === 'counter' ? 'counter' : 'tables'
    } catch {
      return 'tables'
    }
  })
  function choose(next: TillMode) {
    setMode(next)
    try {
      localStorage.setItem(MODE_KEY, next)
    } catch {
      // A private window: it opens on Tables next time.
    }
  }
  return [hasTables ? mode : null, choose]
}

/** "Tables · 3 open | Counter": only at a branch with tables. */
export function TillModeSwitch({ mode, onChange, open }: { mode: TillMode; onChange: (mode: TillMode) => void; open?: number }) {
  return (
    <div role="tablist" aria-label="Tables or counter" className="inline-grid grid-cols-2 gap-1 rounded-lg border border-neutral-200 bg-white p-0.5 text-sm font-semibold">
      {(
        [
          ['tables', open ? `Tables · ${open} open` : 'Tables'],
          ['counter', 'Counter'],
        ] as const
      ).map(([value, text]) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={mode === value}
          onClick={() => onChange(value)}
          className={`min-h-9 rounded-md px-3 whitespace-nowrap ${mode === value ? 'bg-action text-white' : 'text-neutral-700 hover:bg-neutral-50'}`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

/** The open bills at a branch, shared by the switch's count and the grid. */
export function useOpenBills(branchId: string | undefined) {
  const online = useOnlineStatus()
  return useApiQuery<BillSummary[]>({
    queryKey: ['bills', branchId ?? null],
    queryFn: () => billsApi.open(branchId!),
    fallbackError: "Couldn't load the open bills.",
    enabled: !!branchId && online,
    refetchInterval: 20_000,
  })
}

/**
 * Tables (V99, selling till Step 7): amber with a bill open - its total, how long and who opened it - white when free.
 * Tap one for its bill. Bills for a name sit after the tables, with a way to start one.
 */
export function TablesView({ branch, header }: { branch: Branch; header: ReactNode }) {
  const navigate = useNavigate()
  const online = useOnlineStatus()
  const bills = useOpenBills(branch.id)
  const [, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const open = bills.data ?? []
  const byTable = new Map(open.filter((bill) => bill.tableId).map((bill) => [bill.tableId!, bill]))
  const named = open.filter((bill) => !bill.tableId)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 lg:h-full lg:overflow-y-auto lg:p-6" data-tables>
      {header}
      {!online && <p className="text-sm text-neutral-600">Tables need a connection, so every phone sees the same bills. Counter works offline.</p>}
      {bills.error && <p role="alert" className="text-sm text-danger-700">{bills.error}</p>}
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))]" aria-label="Tables">
        {(branch.tables ?? []).map((table) => {
          const bill = byTable.get(table.id)
          return (
            <li key={table.id}>
              <button
                type="button"
                onClick={() => navigate(`/app/sell/bill?table=${table.id}`)}
                className={`flex min-h-16 w-full flex-col justify-between rounded-lg border px-2.5 py-2 text-left tabular-nums ${
                  bill ? 'border-warning-300 bg-warning-50' : 'border-neutral-200 bg-white hover:border-primary-600'
                }`}
              >
                <span className="text-sm font-semibold text-neutral-900">{table.name}</span>
                {bill && (
                  <span className="text-xs leading-tight text-warning-900">
                    {formatMoney(bill.total)} · {openFor(bill.openedAt)}
                    {bill.openedByName ? ` · ${bill.openedByName.split(' ')[0]}` : ''}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      {named.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-neutral-700">Bills for a name</h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {named.map((bill) => (
              <li key={bill.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/app/sell/bill?id=${bill.id}`)}
                  className="flex min-h-14 w-full flex-col justify-between rounded-lg border border-warning-300 bg-warning-50 px-2.5 py-2 text-left tabular-nums"
                >
                  <span className="truncate text-sm font-semibold text-neutral-900">{bill.label}</span>
                  <span className="text-xs text-warning-900">
                    {formatMoney(bill.total)} · {openFor(bill.openedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {naming ? (
        <form
          className="flex max-w-md gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (name.trim()) navigate(`/app/sell/bill?name=${encodeURIComponent(name.trim())}`)
          }}
        >
          <label htmlFor="bill-name" className="sr-only">
            Who is the bill for
          </label>
          <input
            id="bill-name"
            autoFocus
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            placeholder="A name: Tunde, Takeaway 3"
            className="h-11 min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-3 text-base"
          />
          <button type="submit" disabled={!name.trim()} className="h-11 rounded-md bg-action px-4 text-sm font-semibold text-white disabled:opacity-50">
            Open
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setNaming(true)} className="self-start text-sm font-semibold text-primary-700 hover:underline">
          + A bill for a name (bar tab, takeaway)
        </button>
      )}
      {open.length > 0 && (
        <p className="text-xs text-neutral-500">
          {open.length} open · {formatMoney(open.reduce((sum, bill) => sum + bill.total, 0))} so far
        </p>
      )}
    </div>
  )
}
