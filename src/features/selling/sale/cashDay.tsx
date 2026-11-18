import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUp, ClipboardCheck } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useApiQuery } from '@/data/useApiQuery'
import { isAppError } from '@/types/api'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useSellingPolicy } from '@/features/selling/useSellingPolicy'

/** A drawer's day (API V97, selling till Step 13): the cash at one area of a branch. */
export interface Drawer {
  id: string
  branchId: string
  areaId?: string
  areaName?: string
  openedAt: string
  openedByName?: string
  closed: boolean
  closedAt?: string
  counted?: number
  salesCount: number
  mayCountAgain: boolean
}

export interface TillState {
  countsCash: boolean
  open?: Drawer
  closedToday?: Drawer
}

/** The close as the person asking sees it: the owner's figures are absent for someone who can't see sales profit. */
export interface CloseResult {
  drawer: Drawer
  salesAmount: number
  salesCount: number
  floatAmount?: number
  floatSkipped?: boolean
  cashSales?: number
  moneyOut?: number
  expected?: number
  difference?: number
  otherPayments?: { label: string; amount: number }[]
}

export type OutKind = 'COST' | 'BANK' | 'OWNER' | 'OTHER'

export const cashDayApi = {
  till: (branchId: string, areaId?: string) =>
    api.get<TillState>('/api/cash-days/till', { params: { branchId, areaId } }).then((r) => r.data),
  today: (branchId: string) => api.get<Drawer[]>('/api/cash-days/today', { params: { branchId } }).then((r) => r.data),
  start: (branchId: string, areaId: string | undefined, floatAmount: number | null) =>
    api
      .post<Drawer>('/api/cash-days', { branchId, areaId, floatAmount: floatAmount ?? undefined, skipped: floatAmount == null })
      .then((r) => r.data),
  moneyOut: (id: string, amount: number, kind: OutKind, note: string) =>
    api.post(`/api/cash-days/${id}/money-out`, { amount, kind, note: note.trim() || undefined }),
  close: (id: string, counted: number) => api.post<CloseResult>(`/api/cash-days/${id}/close`, { counted }).then((r) => r.data),
  countAgain: (id: string, counted: number) =>
    api.post<CloseResult>(`/api/cash-days/${id}/count-again`, { counted }).then((r) => r.data),
  get: (id: string) => api.get<CloseResult>(`/api/cash-days/${id}`).then((r) => r.data),
  leftOpen: (branchIds: string[]) =>
    api.get<Drawer[]>('/api/cash-days/left-open', { params: { branchIds: branchIds.join(',') } }).then((r) => r.data),
}

export const tillKey = (branchId: string | undefined, areaId: string | undefined) => ['cash-till', branchId ?? null, areaId ?? null]

/** The till's drawer, while "Count cash at open and close" is on; nothing at all while it's off. */
export function useCashTill(branchId: string | undefined, areaId: string | undefined) {
  const { countsCash } = useSellingPolicy()
  const online = useOnlineStatus()
  return useApiQuery<TillState>({
    queryKey: tillKey(branchId, areaId),
    queryFn: () => cashDayApi.till(branchId!, areaId),
    fallbackError: "Couldn't load the drawer.",
    enabled: countsCash && !!branchId && online,
  })
}

/** Digits only, as typed: "20,000" -> 20000. */
export function moneyTyped(value: string): number | null {
  const digits = value.replace(/[^0-9.]/g, '')
  return digits === '' ? null : Number(digits)
}

/**
 * "Start the day" (owner, 2026-11-18): a bar on top of the till until the drawer is started - one number, the cash
 * counted into the drawer now. Selling isn't blocked. "No cash yet" starts it at nothing.
 */
export function StartDayBar({ branchId, areaId, placeName }: { branchId: string; areaId?: string; placeName?: string }) {
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  async function start(floatAmount: number | null) {
    setBusy(true)
    setProblem(null)
    try {
      await cashDayApi.start(branchId, areaId, floatAmount)
      await queryClient.invalidateQueries({ queryKey: ['cash-till'] })
    } catch (error) {
      setProblem(isAppError(error) ? error.message : "Couldn't start the day. Try again.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const value = moneyTyped(amount)
        if (value != null) void start(value)
      }}
      className="flex flex-col gap-1.5 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2"
      data-start-day
    >
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="start-day-cash" className="min-w-0 flex-1 text-sm">
          <span className="block font-semibold text-neutral-900">Start the day{placeName ? ` · ${placeName}` : ''}</span>
          <span className="block text-xs text-neutral-600">Cash in your drawer now</span>
        </label>
        <input
          id="start-day-cash"
          inputMode="numeric"
          placeholder="₦0"
          value={amount}
          onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ''))}
          className="h-10 w-28 rounded-md border border-neutral-300 bg-white px-2 text-right text-base font-semibold tabular-nums focus:border-primary-600 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || moneyTyped(amount) == null}
          className="h-10 rounded-md bg-action px-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          Start
        </button>
      </div>
      <button type="button" onClick={() => void start(null)} disabled={busy} className="self-start text-xs font-medium text-neutral-600 hover:underline">
        No cash yet
      </button>
      {problem && <p role="alert" className="text-xs text-danger-700">{problem}</p>}
    </form>
  )
}

/**
 * Between customers, where Paid with sits (owner, 2026-11-18): the drawer and since when, then Take money out and
 * Close the day - plain text with a picture, Close the day the one that stands out. Closed today: when it closed.
 */
export function DrawerLine({ till, placeName }: { till: TillState; placeName?: string }) {
  const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (till.open) {
    return (
      <div className="flex flex-col gap-1" data-drawer-line>
        <p className="text-xs text-neutral-500">
          {till.open.areaName ?? placeName ?? 'Your'} drawer · since {time(till.open.openedAt)}
        </p>
        <div className="flex items-center justify-between gap-3 text-sm">
          <Link to={`/app/sell/money-out?day=${till.open.id}`} className="inline-flex min-h-10 items-center gap-1.5 font-medium text-neutral-800 hover:underline">
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
            Take money out
          </Link>
          <Link to="/app/sell/close" className="inline-flex min-h-10 items-center gap-1.5 font-bold text-primary-700 hover:underline">
            <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
            Close the day
          </Link>
        </div>
      </div>
    )
  }
  if (till.closedToday) {
    return (
      <p className="text-xs text-neutral-500" data-drawer-line>
        {till.closedToday.areaName ?? placeName ?? 'Your'} drawer closed at {time(till.closedToday.closedAt!)}. A cash sale opens it again.
      </p>
    )
  }
  return null
}

/**
 * The dashboard's one line for a drawer left open from before today (Step 13): no reminders - the owner sees it the
 * next morning, once it's there, and it goes when the drawer is closed.
 */
export function DrawersLeftOpen({ branchIds }: { branchIds: string[] }) {
  const { countsCash } = useSellingPolicy()
  const left = useApiQuery<Drawer[]>({
    queryKey: ['cash-left-open', ...branchIds],
    queryFn: () => cashDayApi.leftOpen(branchIds),
    fallbackError: "Couldn't load the drawers.",
    enabled: countsCash && branchIds.length > 0,
  })
  const drawers = left.data ?? []
  if (drawers.length === 0) return null
  const names = drawers.map((drawer) => drawer.areaName ?? 'A drawer')
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm" data-drawers-left-open>
      <span className="min-w-0">
        <span className="block font-semibold text-warning-800">
          {names.length === 1 ? `${names[0]} wasn't closed` : `${names.length} drawers weren't closed`}
        </span>
        <span className="block text-neutral-600">
          {drawers.map((drawer) => `${drawer.areaName ?? 'Drawer'} · open since ${new Date(drawer.openedAt).toLocaleDateString(undefined, { weekday: 'short' })}${drawer.openedByName ? ` · ${drawer.openedByName}` : ''}`).join(' · ')}
        </span>
      </span>
      <Link to="/app/sell/close" className="shrink-0 font-semibold text-primary-700 hover:underline">
        Close it
      </Link>
    </div>
  )
}
