import { MoneyInput } from '@/features/selling/MoneyInput'
import { chargeLabel } from '@/features/selling/charges'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Search, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/Button'
import { useToast } from '@/components/useToast'
import { useApiQuery } from '@/data/useApiQuery'
import { isAppError } from '@/types/api'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import type { Product } from '@/features/products/types'
import { formatNumber } from '@/features/products/unitCopy'
import { useProductFinder } from '@/features/catalog/useProductFinder'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { useSheetArea } from '@/features/branches/useSheetBranch'
import { formatMoney } from '@/features/selling/money'
import { PaymentButtons } from '@/features/selling/sale/payment'
import type { SalePaymentMethod } from '@/features/selling/sale/paymentMethod'
import { SaleProductGrid } from '@/features/selling/sale/SaleProductGrid'
import { BasketLine } from '@/features/selling/sale/SaleBasketEditor'
import { TransferAccountChooser } from '@/features/selling/sale/TransferAccounts'
import { lineAmount, optionOf, unitsFor, type SaleLine } from '@/features/selling/sale/saleLine'
import { useSaleBasket } from '@/features/selling/sale/useSaleBasket'
import { useSellingPolicy } from '@/features/selling/useSellingPolicy'
import { billsApi, tableLabel, type Bill, type BillSummary, type SentLine } from '@/features/selling/bills/billsApi'

/** A meal a side can go with: a line on the bill already sent, or a new one. */
interface Meal {
  key: string
  name: string
  /** A new line of several: choosing it makes one of them its own plate. */
  quantity: number
  sent: boolean
  note?: string
}

const NOTES_KEY = (branchId: string) => `bill-notes:${branchId}`
function readNotes(branchId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(NOTES_KEY(branchId)) ?? '[]') as string[]
  } catch {
    return []
  }
}
function keepNotes(branchId: string, used: string[]) {
  try {
    const merged = [...new Set([...used, ...readNotes(branchId)])].slice(0, 8)
    localStorage.setItem(NOTES_KEY(branchId), JSON.stringify(merged))
  } catch {
    // A private window: suggestions just don't come back.
  }
}

/**
 * A table's bill (V99, selling till Steps 7 and 9; owner, 2026-11-19). Record a sale's till, kept open: what was sent
 * is at the top with when and by whom; new items go under it and are sent with Send, each from where it's made or
 * kept. A side asks which meal it goes with, on the product buttons, when the bill has more than one. With nothing
 * new to send, the foot is the bill to pay.
 */
export function BillPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const online = useOnlineStatus()
  const { sideCategoryIds } = useSellingPolicy()
  const branchHere = useOptionalWorkingBranch()
  const branch = branchHere && !branchHere.isAll ? (branchHere.working ?? branchHere.branches[0] ?? null) : null
  const tableId = params.get('table')
  const forName = params.get('name')
  const [draftKey] = useState(() => `bill:${tableId ? `t:${tableId}` : forName ? `n:${forName}` : params.get('id')}`)
  const basket = useSaleBasket(draftKey)
  // The till's own area: where the cash goes when it's paid here (Step 13), and where an item with no home comes from.
  const tillArea = useSheetArea(branch).areaId

  const openBills = useApiQuery<BillSummary[]>({
    queryKey: ['bills', branch?.id ?? null],
    queryFn: () => billsApi.open(branch!.id),
    fallbackError: "Couldn't load the open bills.",
    enabled: !!branch && online,
    refetchInterval: 20_000,
  })
  const billId = params.get('id') ?? (tableId ? openBills.data?.find((open) => open.tableId === tableId)?.id : undefined)
  const bill = useApiQuery<Bill>({
    queryKey: ['bill', billId ?? null],
    queryFn: () => billsApi.get(billId!),
    fallbackError: "Couldn't load the bill.",
    enabled: !!billId && online,
    refetchInterval: 20_000,
  })
  const served = useApiQuery<{ productId: string; areaId: string }[]>({
    queryKey: ['served-from', branch?.id ?? null],
    queryFn: () => billsApi.servedFrom(branch!.id),
    fallbackError: "Couldn't load where things are made.",
    enabled: !!branch && online,
    staleTime: 5 * 60_000,
  })
  const servedFrom = useMemo(() => new Map((served.data ?? []).map((row) => [row.productId, row.areaId])), [served.data])
  const areaOf = (productId: string) => servedFrom.get(productId) ?? tillArea
  const areaName = (areaId?: string) => branch?.areas?.find((area) => area.id === areaId)?.name

  const table = branch?.tables?.find((candidate) => candidate.id === (tableId ?? bill.data?.summary.tableId))
  const label = table ? tableLabel(table.name) : (bill.data?.summary.label ?? forName ?? 'Bill')
  const sent = bill.data?.lines ?? []
  const live = sent.filter((line) => !line.takenOff)
  // Step 10: the food and drinks plus the branch's charges added on top, as they'd be paid now.
  const billTotal = bill.data?.summary.toPay ?? bill.data?.summary.total ?? 0
  const billCharges = (bill.data?.charges ?? []).filter((charge) => charge.amount > 0)
  const isSide = (product: Product) => !!product.categoryId && sideCategoryIds.includes(product.categoryId)

  // ------------------------------------------------------------------ adding: sides ask which meal
  const [term, setTerm] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const [choosing, setChoosing] = useState<{ product: Product; lineKey?: string } | null>(null)

  function mealsFor(sideAreaId: string | undefined): Meal[] {
    const sameKitchen = (productId: string) => !sideAreaId || areaOf(productId) === sideAreaId
    const sentMeals: Meal[] = live
      .filter((line) => !line.withKey && !sideCategoryIds.includes(line.categoryId ?? '') && sameKitchen(line.productId))
      .map((line) => ({ key: line.lineKey, name: line.productName, quantity: Number(line.enteredQuantity ?? line.quantity), sent: true, note: line.note }))
    const newMeals: Meal[] = basket.lines
      .filter((line) => !line.withKey && !isSide(line.product) && sameKitchen(line.product.id))
      .map((line) => ({ key: line.key, name: line.product.name, quantity: line.quantity, sent: false, note: line.note }))
    return [...sentMeals, ...newMeals]
  }
  function add(product: Product) {
    if (term !== '') {
      setTerm('')
      searchRef.current?.focus()
    }
    if (!isSide(product)) {
      basket.add(product)
      return
    }
    const meals = mealsFor(areaOf(product.id))
    if (meals.length === 0) basket.add(product)
    else if (meals.length === 1 && meals[0].quantity === 1) basket.add(product, meals[0].key)
    else setChoosing({ product })
  }

  function attach(meal: Meal | null) {
    if (!choosing) return
    let withKey = meal?.key
    if (meal && !meal.sent && meal.quantity > 1) withKey = basket.splitOne(meal.key)
    if (choosing.lineKey) basket.update(choosing.lineKey, { withKey })
    else basket.add(choosing.product, withKey)
    setChoosing(null)
  }

  const finder = useProductFinder(term, add, 30, true, { wholeBranch: true })

  // ------------------------------------------------------------------ sending
  const [sending, setSending] = useState(false)
  const newTotal = basket.lines.reduce((sum, line) => {
    const options = unitsFor(line.product, basket.catalogue)
    return sum + (lineAmount(line, optionOf(line, options), options) ?? 0)
  }, 0)
  const goesTo = useMemo(() => {
    const count = new Map<string, number>()
    for (const line of basket.lines) {
      const name = areaName(areaOf(line.product.id)) ?? 'Here'
      count.set(name, (count.get(name) ?? 0) + line.quantity)
    }
    return [...count.entries()].map(([name, n]) => `${name} gets ${formatNumber(n)}`).join(' · ')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basket.lines, servedFrom, tillArea])

  async function sendNew() {
    if (!branch || basket.lines.length === 0) return
    setSending(true)
    try {
      let id = billId
      if (!id) {
        const opened = await billsApi.start(branch.id, tableId ? { tableId } : { name: forName ?? '' })
        id = opened.id
        if (!tableId) setParams({ id }, { replace: true })
      }
      const notes = basket.lines.map((line) => line.note?.trim()).filter((note): note is string => !!note)
      const result = await basket.send(id, `sent to ${label}`, (line) => areaOf(line.product.id))
      const refused = result.filter((line) => line.status === 'refused')
      keepNotes(branch.id, notes)
      if (refused.length === 0) showToast(`${result.length} ${result.length === 1 ? 'item' : 'items'} sent.`, 'success')
      else showToast(refused[0].message ?? 'Some items were not sent.', 'error')
      await queryClient.invalidateQueries({ queryKey: ['bills'] })
      await queryClient.invalidateQueries({ queryKey: ['bill'] })
    } catch (error) {
      showToast(isAppError(error) ? error.message : "Couldn't send. Try again.", 'error')
    } finally {
      setSending(false)
    }
  }

  // ------------------------------------------------------------------ paying
  const accounts = branch?.paymentAccounts ?? []
  const [choosingAccount, setChoosingAccount] = useState(false)
  const [paying, setPaying] = useState<SalePaymentMethod | null>(null)
  // Step 11: paying in parts - evenly between N people (remembered on this phone for the bill), or any amount.
  const [splitting, setSplitting] = useState(false)
  const [splitAmount, setSplitAmount] = useState('')
  const [people, setPeopleState] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem(`bill-split:${params.get('id') ?? tableId}`)
      return saved ? Number(saved) : null
    } catch {
      return null
    }
  })
  function setPeople(n: number | null) {
    setPeopleState(n)
    try {
      if (n) localStorage.setItem(`bill-split:${params.get('id') ?? tableId}`, String(n))
      else localStorage.removeItem(`bill-split:${params.get('id') ?? tableId}`)
    } catch {
      // A private window: the split is forgotten on reload, nothing else.
    }
  }
  const paidSoFar = bill.data?.summary.paid ?? 0
  const left = bill.data?.summary.left ?? billTotal
  const payments = bill.data?.payments ?? []
  // The next part: an even share (the last one takes what's left), an amount typed, or the rest.
  const evenShare = people ? Math.round(billTotal / people) : null
  const partsLeft = people ? people - payments.length : null
  const typedPart = Number(splitAmount.replace(/,/g, '')) || 0
  const nextPart =
    splitting && !people
      ? Math.min(typedPart, left)
      : evenShare != null && partsLeft != null && partsLeft > 1
        ? Math.min(evenShare, left)
        : left

  async function pay(method: SalePaymentMethod, accountId?: string) {
    if (!billId || !(nextPart > 0)) return
    if (method === 'TRANSFER' && accountId === undefined && accounts.length > 1) {
      setChoosingAccount(true)
      return
    }
    setChoosingAccount(false)
    setPaying(method)
    try {
      const part = nextPart < left ? nextPart : undefined
      const result = await billsApi.pay(
        billId,
        method,
        accountId ?? (method === 'TRANSFER' && accounts.length === 1 ? accounts[0].id : undefined),
        tillArea,
        part,
      )
      await queryClient.invalidateQueries({ queryKey: ['bills'] })
      void queryClient.invalidateQueries({ queryKey: ['cash-till'] })
      if (result.paid && result.sale) {
        setPeople(null)
        showToast(`${label} paid.`, 'success')
        navigate(`/app/sales/${result.sale.saleId}`, { replace: true })
        return
      }
      if (result.bill) queryClient.setQueryData(['bill', billId], result.bill)
      setSplitting(false)
      setSplitAmount('')
      showToast(`${formatMoney(part ?? 0)} paid · ${formatMoney(result.bill?.summary.left ?? 0)} left.`, 'success')
    } catch (error) {
      showToast(isAppError(error) ? error.message : "Couldn't record the payment. Try again.", 'error')
    } finally {
      setPaying(null)
    }
  }

  async function closeEmpty() {
    if (!billId) return
    try {
      await billsApi.close(billId)
      await queryClient.invalidateQueries({ queryKey: ['bills'] })
      navigate('/app/sell', { replace: true })
    } catch (error) {
      showToast(isAppError(error) ? error.message : "Couldn't close it. Try again.", 'error')
    }
  }

  // ------------------------------------------------------------------ the screen
  const [topbarSlot, setTopbarSlot] = useState<HTMLElement | null>(null)
  useEffect(() => setTopbarSlot(document.getElementById('topbar-page-slot')), [])
  const since = bill.data?.summary.openedAt
    ? `since ${new Date(bill.data.summary.openedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}${
        bill.data.summary.openedByName ? ` · ${bill.data.summary.openedByName}` : ''
      }`
    : 'new bill'
  const back = (
    <button
      type="button"
      onClick={() => navigate('/app/sell')}
      aria-label="Back to the tables"
      className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
    >
      <ArrowLeft className="h-5 w-5" aria-hidden="true" />
    </button>
  )
  const heading = (
    <>
      {back}
      <h1 className="text-xl font-semibold whitespace-nowrap text-neutral-900 lg:text-lg">{label}</h1>
      <span className="truncate text-sm text-neutral-500">{since}</span>
    </>
  )

  if (!branch) {
    return <p className="p-4 text-sm text-neutral-600">Choose a branch first.</p>
  }
  if (!online) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-3 py-8">
        <div className="flex items-center gap-2">{heading}</div>
        <p className="text-sm text-neutral-600">Tables need a connection, so every phone sees the same bill. Counter sales still work offline.</p>
      </div>
    )
  }

  const typing = term.trim() !== ''
  // On a bill, items are what goes out: two Heineken are 2, as the kitchen and bar count them.
  const newCount = basket.lines.reduce((sum, line) => sum + line.quantity, 0)
  const liveCount = live.reduce((sum, line) => sum + Number(line.enteredQuantity ?? line.quantity), 0)

  const searchBox = (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
      <label htmlFor="bill-search" className="sr-only">
        Scan or search a product
      </label>
      <input
        ref={searchRef}
        id="bill-search"
        type="search"
        autoComplete="off"
        enterKeyHint="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            finder.onEnter()
          }
          if (event.key === 'Escape') setTerm('')
        }}
        placeholder="Scan or search a product…"
        className="h-12 w-full rounded-lg border border-neutral-300 bg-white pr-3 pl-11 text-base text-neutral-900 placeholder:text-neutral-500 focus:border-primary-600 focus:ring-2 focus:ring-primary-100 focus:outline-none"
      />
    </div>
  )

  const picker = choosing && (
    <SidePicker
      side={choosing.product.name}
      meals={mealsFor(areaOf(choosing.product.id))}
      onPick={attach}
      onBack={() => setChoosing(null)}
    />
  )

  const panel = (
    <div className={`${typing ? 'hidden lg:flex' : 'flex'} flex-col gap-2 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:min-h-0 lg:gap-0 lg:border-l lg:border-neutral-200 lg:bg-white`}>
      <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-4 lg:pt-3">
        {sent.length > 0 && (
          <SentLines
            billId={billId!}
            lines={sent}
            onChanged={(next) => {
              queryClient.setQueryData(['bill', billId], next)
              void queryClient.invalidateQueries({ queryKey: ['bills'] })
            }}
          />
        )}
        {newCount > 0 && (
          <>
            {sent.length > 0 && (
              <p className="mt-3 mb-1 flex justify-between px-1 text-xs font-semibold text-neutral-500 tabular-nums">
                <span>New</span>
                <span>{formatMoney(newTotal)}</span>
              </p>
            )}
            <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white lg:-mx-3 lg:rounded-none lg:border-0" aria-label="New items">
              {orderedNew(basket.lines).map((line) => {
                const meal = line.withKey ? mealName(line.withKey, sent, basket.lines) : undefined
                return (
                  <BasketLine
                    key={line.key}
                    line={line}
                    side={!!line.withKey}
                    place={{ branchId: branch.id, areaId: areaOf(line.product.id) }}
                    catalogue={basket.catalogue}
                    canMakeUsual={false}
                    makeUsual={false}
                    onMakeUsual={() => {}}
                    onChange={(patch) => basket.update(line.key, patch)}
                    onRemove={() => basket.remove(line.key)}
                    below={
                      <LineExtras
                        branchId={branch.id}
                        line={line}
                        from={areaName(areaOf(line.product.id))}
                        meal={meal}
                        onChangeMeal={() => setChoosing({ product: line.product, lineKey: line.key })}
                        onNote={(note) => basket.update(line.key, { note })}
                      />
                    }
                  />
                )
              })}
            </ul>
          </>
        )}
        {sent.length === 0 && newCount === 0 && (
          <p className="py-6 text-center text-sm text-neutral-500 lg:py-16">Tap a product to start {label}'s bill.</p>
        )}
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-1.5 border-t border-neutral-200 bg-white px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:mx-0 lg:static lg:gap-3 lg:pt-3 lg:pb-4">
        {newCount > 0 ? (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-neutral-600">
                {formatNumber(newCount)} new {newCount === 1 ? 'item' : 'items'}
              </p>
              <p className="text-xl font-semibold text-neutral-900 tabular-nums">{formatMoney(newTotal)}</p>
            </div>
            <Button variant="action" className="min-h-12 flex-col" loading={sending} onClick={() => void sendNew()}>
              <span>
                Send {formatNumber(newCount)} {newCount === 1 ? 'item' : 'items'}
              </span>
              <span className="text-xs font-normal opacity-85">{goesTo}</span>
            </Button>
          </>
        ) : live.length > 0 ? (
          <>
            {billCharges.some((charge) => !charge.included) && (
              <dl className="flex flex-col text-sm tabular-nums">
                <div className="flex justify-between gap-3">
                  <dt className="text-neutral-600">Food and drinks</dt>
                  <dd className="text-neutral-900">{formatMoney(bill.data?.summary.total ?? 0)}</dd>
                </div>
                {billCharges
                  .filter((charge) => !charge.included)
                  .map((charge) => (
                    <div key={charge.name} className="flex justify-between gap-3">
                      <dt className="text-neutral-600">{chargeLabel(charge)}</dt>
                      <dd className="text-neutral-900">{formatMoney(charge.amount)}</dd>
                    </div>
                  ))}
              </dl>
            )}
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-neutral-600">
                To pay · {formatNumber(liveCount)} {liveCount === 1 ? 'item' : 'items'}
              </p>
              <p className="text-xl font-semibold text-neutral-900 tabular-nums lg:text-3xl">{formatMoney(billTotal)}</p>
            </div>
            {billCharges
              .filter((charge) => charge.included)
              .map((charge) => (
                <p key={charge.name} className="-mt-1 flex justify-between text-xs text-neutral-500 tabular-nums">
                  <span>Includes {chargeLabel(charge)}</span>
                  <span>{formatMoney(charge.amount)}</span>
                </p>
              ))}
            {payments.length > 0 && (
              <div className="flex flex-col gap-1 rounded-lg border border-warning-300 bg-warning-50 px-3 py-2 text-sm tabular-nums" data-part-paid>
                <p className="flex justify-between font-semibold text-warning-900">
                  <span>
                    {formatMoney(paidSoFar)} paid of {formatMoney(billTotal)}
                  </span>
                  {people && (
                    <span>
                      {payments.length} of {people}
                    </span>
                  )}
                </p>
                {payments.map((payment, index) => (
                  <p key={index} className="flex justify-between text-accent-800">
                    <span>
                      {payment.method === 'CASH' ? 'Cash' : payment.method === 'CARD' ? 'Card' : `Transfer${payment.accountName ? ` · ${payment.accountName}` : ''}`}
                    </span>
                    <span>{formatMoney(payment.amount)}</span>
                  </p>
                ))}
                <p className="flex justify-between font-semibold text-warning-900">
                  <span>Left</span>
                  <span>{formatMoney(left)}</span>
                </p>
              </div>
            )}
            {splitting && payments.length === 0 && (
              <SplitChooser
                total={billTotal}
                people={people}
                onPeople={(n) => {
                  setPeople(n)
                  setSplitAmount('')
                }}
                amount={splitAmount}
                onAmount={(text) => {
                  setSplitAmount(text)
                  setPeople(null)
                }}
                onCancel={() => {
                  setSplitting(false)
                  setPeople(null)
                  setSplitAmount('')
                }}
              />
            )}
            {choosingAccount ? (
              <TransferAccountChooser
                branchId={branch.id}
                accounts={accounts}
                amount={nextPart}
                busy={paying === 'TRANSFER'}
                onPick={(account) => void pay('TRANSFER', account.id)}
                onBack={() => setChoosingAccount(false)}
              />
            ) : (
              <>
                <p className="text-xs font-medium text-neutral-500" aria-hidden="true">
                  {nextPart < left || payments.length > 0
                    ? `${payments.length === 0 ? 'The first part' : nextPart < left ? 'The next part' : 'The last part'}, ${formatMoney(nextPart)}, paid with`
                    : 'Paid with'}
                </p>
                <div className={nextPart > 0 ? '' : 'pointer-events-none opacity-35'}>
                  <PaymentButtons label={`Paid with, ${formatMoney(nextPart)}`} busy={paying} onPick={(method) => void pay(method)} />
                </div>
                {!splitting && payments.length === 0 && (
                  <button type="button" onClick={() => setSplitting(true)} className="min-h-10 text-sm font-semibold text-primary-700 hover:underline">
                    Split the bill
                  </button>
                )}
                {payments.length > 0 && (
                  <button type="button" onClick={() => navigate('/app/sell')} className="min-h-10 text-sm font-medium text-neutral-600 hover:underline">
                    Keep the rest open for later
                  </button>
                )}
              </>
            )}
          </>
        ) : billId && bill.data ? (
          <Button variant="secondary" className="min-h-11" onClick={() => void closeEmpty()}>
            Nothing on this bill · Close it
          </Button>
        ) : null}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-4 lg:grid lg:h-full lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-0">
      {topbarSlot && createPortal(<div className="flex min-w-0 items-center gap-3">{heading}</div>, topbarSlot)}
      <div className="flex flex-col gap-3 lg:col-start-1 lg:row-start-1 lg:bg-neutral-50 lg:px-4 lg:pt-4">
        <div className="flex min-w-0 items-center gap-2 lg:hidden">{heading}</div>
        {searchBox}
      </div>
      {panel}
      <div className="lg:col-start-1 lg:row-start-2 lg:min-h-0 lg:overflow-y-auto lg:bg-neutral-50 lg:px-4 lg:pt-3 lg:pb-6">
        {picker ?? (
          <SaleProductGrid
            basket={basket}
            search={finder.search}
            searchResults={finder.results}
            searchAnswered={finder.answered}
            onPick={add}
            wholeBranch
          />
        )}
      </div>
    </div>
  )
}

/** New lines in the order a plate is served: each meal, then its sides; sides of sent meals last. */
function orderedNew(lines: SaleLine[]): SaleLine[] {
  const meals = lines.filter((line) => !line.withKey)
  const ordered: SaleLine[] = []
  for (const meal of meals) {
    ordered.push(meal, ...lines.filter((line) => line.withKey === meal.key))
  }
  return [...ordered, ...lines.filter((line) => line.withKey && !meals.some((meal) => meal.key === line.withKey))]
}

function mealName(key: string, sent: SentLine[], lines: SaleLine[]): string | undefined {
  return sent.find((line) => line.lineKey === key)?.productName ?? lines.find((line) => line.key === key)?.product.name
}

// ---------------------------------------------------------------------------------- which meal

/**
 * "Extra chicken goes with…" (owner, 2026-11-19): on the product buttons, one button per plate on the bill from the same
 * kitchen - two Jollof are two buttons - and "On its own".
 */
function SidePicker({ side, meals, onPick, onBack }: { side: string; meals: Meal[]; onPick: (meal: Meal | null) => void; onBack: () => void }) {
  const seen = new Map<string, number>()
  const total = new Map<string, number>()
  for (const meal of meals) total.set(meal.name, (total.get(meal.name) ?? 0) + meal.quantity)
  const ordinal = (n: number) => ['1st', '2nd', '3rd'][n - 1] ?? `${n}th`
  return (
    <div className="flex flex-col gap-2 rounded-xl border-2 border-primary-600 bg-primary-50 p-3" role="group" aria-label={`${side} goes with`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold text-neutral-900">{side} goes with</p>
        <button type="button" onClick={onBack} className="text-sm font-semibold text-primary-700 hover:underline">
          Back
        </button>
      </div>
      {meals.flatMap((meal) =>
        Array.from({ length: Math.max(1, meal.sent ? 1 : meal.quantity) }, (_, index) => {
          const n = (seen.get(meal.name) ?? 0) + 1
          seen.set(meal.name, n)
          const many = (total.get(meal.name) ?? 1) > 1
          const extra = [many ? (meal.sent && meal.quantity > 1 ? `one of ${formatNumber(meal.quantity)}` : ordinal(n)) : null, meal.note, meal.sent ? 'sent' : null]
            .filter(Boolean)
            .join(' · ')
          return (
            <button
              key={`${meal.key}-${index}`}
              type="button"
              onClick={() => onPick(meal)}
              className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-3 text-left text-sm font-semibold text-neutral-900 hover:border-primary-600"
            >
              <span>{meal.name}</span>
              <span className="text-xs font-normal text-neutral-500">{extra}</span>
            </button>
          )
        }),
      )}
      <button
        type="button"
        onClick={() => onPick(null)}
        className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-dashed border-neutral-300 bg-white px-3 text-left text-sm text-neutral-600"
      >
        <span>On its own</span>
        <span className="text-xs">a side ordered by itself</span>
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------------- a new line's extras

function LineExtras({
  branchId,
  line,
  from,
  meal,
  onChangeMeal,
  onNote,
}: {
  branchId: string
  line: SaleLine
  from?: string
  meal?: string
  onChangeMeal: () => void
  onNote: (note: string | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  const suggestions = useMemo(() => (open ? readNotes(branchId) : []), [open, branchId])
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          {meal && (
            <button type="button" onClick={onChangeMeal} className="font-semibold text-primary-700 hover:underline">
              with {meal}
            </button>
          )}
          {line.note && !open && (
            <button type="button" onClick={() => setOpen(true)} className="font-semibold text-warning-800">
              {line.note}
            </button>
          )}
          {!line.note && !open && (
            <button type="button" onClick={() => setOpen(true)} className="font-medium text-primary-700 hover:underline">
              Note
            </button>
          )}
        </span>
        {from && <span className="shrink-0 rounded border border-neutral-200 px-1.5 font-semibold text-neutral-500">{from}</span>}
      </div>
      {open && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`note-${line.key}`} className="sr-only">
            Note for the kitchen
          </label>
          <div className="flex gap-2">
            <input
              id={`note-${line.key}`}
              autoFocus
              maxLength={200}
              value={line.note ?? ''}
              placeholder="No pepper"
              onChange={(event) => onNote(event.target.value || undefined)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') setOpen(false)
              }}
              className="h-10 min-w-0 flex-1 rounded-md border-2 border-primary-600 px-2 text-sm focus:outline-none"
            />
            <button type="button" onClick={() => setOpen(false)} className="px-2 text-sm font-semibold text-primary-700">
              Done
            </button>
          </div>
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((note) => (
                <button
                  key={note}
                  type="button"
                  onClick={() => {
                    onNote(note)
                    setOpen(false)
                  }}
                  className="rounded-full border border-neutral-200 px-2.5 py-0.5 text-xs text-neutral-600 hover:bg-neutral-50"
                >
                  {note}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------------- what was sent

function SentLines({ billId, lines, onChanged }: { billId: string; lines: SentLine[]; onChanged: (bill: Bill) => void }) {
  const { showToast } = useToast()
  const [asking, setAsking] = useState<string | null>(null)
  // Sent together: one group per send ("Sent 7:41 · Ada"), meals with their sides under them.
  const groups: { key: string; title: string; lines: SentLine[] }[] = []
  for (const line of lines) {
    const time = new Date(line.sentAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    const key = `${time}|${line.sentByName ?? ''}`
    const last = groups[groups.length - 1]
    if (last?.key === key) last.lines.push(line)
    else groups.push({ key, title: `Sent ${time}${line.sentByName ? ` · ${line.sentByName}` : ''}`, lines: [line] })
  }
  const keys = new Set(lines.map((line) => line.lineKey))
  return (
    <div className="flex flex-col gap-2">
      {groups.map((group) => {
        const meals = group.lines.filter((line) => !line.withKey || !group.lines.some((meal) => meal.lineKey === line.withKey))
        const total = group.lines.filter((line) => !line.takenOff).reduce((sum, line) => sum + (line.amount ?? 0), 0)
        return (
          <section key={group.key} className="overflow-hidden rounded-lg border border-neutral-200 bg-white lg:-mx-3 lg:rounded-none lg:border-0">
            <h2 className="flex justify-between bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-500 tabular-nums">
              <span>{group.title}</span>
              <span>{formatMoney(total)}</span>
            </h2>
            <ul className="divide-y divide-neutral-100">
              {meals.flatMap((meal) => [meal, ...group.lines.filter((line) => line.withKey === meal.lineKey)]).map((line) => (
                <SentRow
                  key={line.movementId}
                  line={line}
                  side={!!line.withKey && keys.has(line.withKey)}
                  asking={asking === line.movementId}
                  onAsk={() => setAsking(line.movementId)}
                  onCancel={() => setAsking(null)}
                  onTakeOff={async (kind, note) => {
                    try {
                      onChanged(await billsApi.takeOff(billId, line.movementId, kind, note))
                      setAsking(null)
                      showToast(`${line.productName} taken off.`, 'success')
                    } catch (error) {
                      showToast(isAppError(error) ? error.message : "Couldn't take it off. Try again.", 'error')
                    }
                  }}
                />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function SentRow({
  line,
  side,
  asking,
  onAsk,
  onCancel,
  onTakeOff,
}: {
  line: SentLine
  side: boolean
  asking: boolean
  onAsk: () => void
  onCancel: () => void
  onTakeOff: (kind: 'NOT_MADE' | 'SENT_BACK', note: string) => Promise<void>
}) {
  // Two questions, apart (owner, 2026-11-19): can it go back into stock, and why it came off. Nothing is picked for them.
  const [kind, setKind] = useState<'NOT_MADE' | 'SENT_BACK' | null>(null)
  const [reason, setReason] = useState<string | null>(null)
  const [other, setOther] = useState('')
  const [busy, setBusy] = useState(false)
  const why = reason === 'Other' ? other.trim() : reason
  const quantity = Number(line.enteredQuantity ?? line.quantity)
  const off = line.takenOff != null
  const extra: ReactNode[] = []
  if (line.note) extra.push(<span key="note" className="font-semibold text-warning-800">{line.note}</span>)
  if (off)
    extra.push(
      <span key="off" className="text-danger-700">
        Taken off · {line.takenOff === 'NOT_MADE' ? (line.madeHere ? 'not made' : 'back to stock') : line.madeHere ? 'already made' : 'opened'}
        {line.takenOffNote ? ` · ${line.takenOffNote}` : ''}
      </span>,
    )
  return (
    <li className={`flex flex-col gap-1 px-3 py-2 ${side ? 'border-l-2 border-neutral-200 bg-neutral-50/60 pl-6' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`min-w-0 text-sm ${off ? 'text-neutral-400 line-through' : 'text-neutral-600'}`}>
          {side && <span className="text-neutral-400">+ </span>}
          {line.productName}
          {quantity !== 1 && ` × ${formatNumber(quantity)}`}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <span className={`text-sm tabular-nums ${off ? 'text-neutral-400 line-through' : 'text-neutral-700'}`}>
            {line.amount != null ? formatMoney(line.amount) : 'No price'}
          </span>
          {!off && !asking && (
            <button
              type="button"
              onClick={onAsk}
              aria-label={`Take ${line.productName} off`}
              className="flex h-9 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-danger-700"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </span>
      </div>
      {extra.length > 0 && <div className="flex flex-wrap gap-2 text-xs">{extra}</div>}
      {asking && (
        <form
          className="mt-1 flex flex-col gap-3 rounded-lg border border-danger-200 bg-danger-50 p-2.5"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!kind || !why) return
            setBusy(true)
            await onTakeOff(kind, why)
            setBusy(false)
          }}
        >
          <p className="text-sm font-semibold text-danger-800">Take {line.productName} off?</p>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-xs font-semibold text-neutral-700">Can it go back?</legend>
            <div role="radiogroup" aria-label="Can it go back?" className="grid grid-cols-2 gap-1.5">
              {(
                line.madeHere
                  ? ([
                      ['NOT_MADE', 'Not made yet', 'Nothing was used'],
                      ['SENT_BACK', 'Already made', 'What it took stays used'],
                    ] as const)
                  : ([
                      ['NOT_MADE', 'Not opened', `Back to ${line.areaName ? `the ${line.areaName}` : 'stock'}`],
                      ['SENT_BACK', 'Opened or spoilt', "Can't go back"],
                    ] as const)
              ).map(([value, title, help]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={kind === value}
                  onClick={() => setKind(value)}
                  className={`rounded-md border bg-white px-2.5 py-1.5 text-left text-sm ${kind === value ? 'border-2 border-primary-600' : 'border-neutral-200'}`}
                >
                  <span className="font-semibold text-neutral-900">{title}</span>
                  <span className="block text-xs text-neutral-500">{help}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-xs font-semibold text-neutral-700">Why?</legend>
            <div role="radiogroup" aria-label="Why?" className="flex flex-wrap gap-1.5">
              {['Changed their mind', 'Wrong item', 'Took too long', "Didn't like it", 'Other'].map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={reason === option}
                  onClick={() => setReason(option)}
                  className={`min-h-9 rounded-full border px-3 text-sm ${
                    reason === option ? 'border-primary-600 bg-primary-600 font-semibold text-white' : 'border-neutral-300 bg-white text-neutral-800'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            {reason === 'Other' && (
              <>
                <label htmlFor={`why-${line.movementId}`} className="sr-only">
                  What happened
                </label>
                <input
                  id={`why-${line.movementId}`}
                  autoFocus
                  value={other}
                  maxLength={200}
                  onChange={(event) => setOther(event.target.value)}
                  placeholder="What happened, in a few words"
                  className="h-10 rounded-md border border-neutral-300 bg-white px-2 text-sm"
                />
              </>
            )}
          </fieldset>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Keep it
            </Button>
            <Button type="submit" variant="danger" loading={busy} disabled={!kind || !why}>
              Take it off
            </Button>
          </div>
        </form>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------------- splitting

/**
 * "Split the bill" (Step 11; owner, 2026-11-19): evenly between people - whole naira, the last part makes up the
 * difference - or any amount. The first part is then paid with the usual buttons.
 */
function SplitChooser({
  total,
  people,
  onPeople,
  amount,
  onAmount,
  onCancel,
}: {
  total: number
  people: number | null
  onPeople: (n: number) => void
  amount: string
  onAmount: (text: string) => void
  onCancel: () => void
}) {
  const each = people ? Math.round(total / people) : null
  const last = people && each != null ? total - each * (people - 1) : null
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2.5" data-split>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-neutral-900">Split the bill</p>
        <button type="button" onClick={onCancel} className="text-sm font-medium text-neutral-600 hover:underline">
          Pay it all at once
        </button>
      </div>
      <p className="text-xs font-medium text-neutral-600">Evenly, between</p>
      <div role="radiogroup" aria-label="Evenly, between" className="grid grid-cols-5 gap-1.5">
        {[2, 3, 4, 5, 6].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={people === n}
            onClick={() => onPeople(n)}
            className={`min-h-10 rounded-md border text-sm font-semibold tabular-nums ${people === n ? 'border-2 border-primary-600 bg-primary-50 text-primary-700' : 'border-neutral-200 bg-white text-neutral-800'}`}
          >
            {n}
          </button>
        ))}
      </div>
      {people && each != null && last != null && (
        <p className="text-sm text-neutral-700 tabular-nums">
          Each pays {formatMoney(each)}
          {last !== each && ` · the last one ${formatMoney(last)}`}
        </p>
      )}
      <label htmlFor="split-amount" className="text-xs font-medium text-neutral-600">
        Or an amount
      </label>
      <MoneyInput
        id="split-amount"
        value={amount}
        onValue={onAmount}
        placeholder="₦"
        className="h-10 rounded-md border border-neutral-300 bg-white px-2 text-base tabular-nums"
      />
    </div>
  )
}
