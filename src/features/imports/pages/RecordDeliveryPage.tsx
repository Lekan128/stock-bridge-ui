import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Check, FileSpreadsheet, Search } from 'lucide-react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { Button, buttonClassName } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { invalidateInventory } from '@/data/inventoryCache'
import { queryKeys } from '@/data/queryKeys'
import { useApiQuery } from '@/data/useApiQuery'
import { DraftNote } from '@/features/drafts/DraftNote'
import { useDraft } from '@/features/drafts/useDraft'
import { expectedApi } from '@/features/expected/api/expectedApi'
import { SupplierSearch } from '@/features/expected/components/SupplierSearch'
import { asDeliveryLine, orderMoney, quantityWords, shortDate } from '@/features/expected/expected'
import { useRecentSuppliers } from '@/features/expected/hooks/useProductPicker'
import type { ExpectedDelivery, PageResponse } from '@/features/expected/types'
import { importsApi } from '@/features/imports/api/importsApi'
import { BarcodeScanField } from '@/features/imports/components/BarcodeScanField'
import { ReceiveLineRow } from '@/features/imports/components/ReceiveLineRow'
import { lineKey, matchesSearch, perUnitWords } from '@/features/imports/delivery'
import { useDeliveryLines } from '@/features/imports/hooks/useDeliveryLines'
import { NO_BACK, amount, priceOf, rowKey, tallyRows, words, type ReceiveRow, type SendBack } from '@/features/imports/receive'
import { receiveCopy as text } from '@/features/imports/receiveCopy'
import type { DeliveryLine } from '@/features/imports/types'
import { useVendorOptions } from '@/features/vendors/hooks/useVendorOptions'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { isAppError } from '@/types/api'

const SPREADSHEET_PATH = '/app/products/import/new?kind=STOCK_IN'
const NONE = 'NONE'
const SHOWN_SUGGESTIONS = 8

function todayIso(): string {
  return new Date().toLocaleDateString('en-CA')
}

/** What Record a delivery keeps on the phone between visits (Pattern C). */
interface ReceiveDraftV2 {
  version: 2
  vendorId: string
  orderId: string
  rows: ReceiveRow[]
  deliveryDate: string
  invoiceNo: string
}

/** After it went in: what to say, and the order to ask about. */
interface Recorded {
  importId: string
  what: string
  order: ExpectedDelivery | null
}

/** Rows for an order's lines still owed: Arrived starts at what was ordered (owner, 2026-11-06). */
function rowsFor(order: ExpectedDelivery): ReceiveRow[] {
  return order.lines
    .filter((line) => line.outstanding > 0)
    .map((line) => ({
      line: asDeliveryLine(line),
      ordered: line.outstanding,
      orderPrice: line.price ?? null,
      arrived: String(line.outstanding),
      price: '',
      back: NO_BACK,
    }))
}

function rowFor(line: DeliveryLine): ReceiveRow {
  return { line, ordered: null, orderPrice: null, arrived: '', price: '', back: NO_BACK }
}

/**
 * Record a delivery, rebuilt around the order (PURCHASE_ORDER_PLAN.md section 11.6; mockups
 * "Record a Delivery Redesign" A–E and "Purchase Flow Redesign" 5A–5C, owner 2026-11-06).
 *
 * Who it's from, then "Which order is this?" with the newest open order already chosen. Its lines
 * show at once with Ordered beside Arrived, so the person at the gate — who may not be who ordered —
 * only changes what is different, and the line says "5 short" as they type. Some can be sent back
 * with a reason; that never becomes stock and stays owed on the order. Date, waybill and prices are
 * one short line each. One button records it (no confirm popup; the result page keeps Undo), and
 * if anything is still owed the next screen asks once whether it is still coming.
 *
 * Underneath it is still the ordinary stock-in import, so a line the server can't take goes to the
 * full review, and anything recorded can be undone.
 */
export function RecordDeliveryPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const expectedParam = searchParams.get('expected')
  const permissions = user?.type === 'tenant' ? user.permissions : []
  const canSeeSuppliers = permissions.includes(PERMISSIONS.VIEW_VENDORS)
  const canManageSuppliers = permissions.includes(PERMISSIONS.MANAGE_VENDORS)
  const canSend = permissions.includes(PERMISSIONS.SEND_PURCHASE_ORDER)
  const { vendors, upsert: addVendor } = useVendorOptions(canSeeSuppliers)
  const recent = useRecentSuppliers(canSeeSuppliers)
  const online = useOnlineStatus()

  const [vendorId, setVendorId] = useState('')
  /** The order being received; NONE for "It's not on an order"; '' until one is chosen. */
  const [orderId, setOrderId] = useState('')
  const [rows, setRows] = useState<ReceiveRow[]>([])
  const [deliveryDate, setDeliveryDate] = useState(todayIso)
  const [invoiceNo, setInvoiceNo] = useState('')
  const [open, setOpen] = useState<'date' | 'invoice' | 'prices' | null>(null)
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recorded, setRecorded] = useState<Recorded | null>(null)
  /** Something was typed or chosen by the person: only then is there a draft worth keeping. */
  const [touched, setTouched] = useState(false)

  const supplierName = vendors.find((vendor) => vendor.id === vendorId)?.name ?? ''

  // ---------------------------------------------------------------- the orders --------------
  const fromLink = useApiQuery<ExpectedDelivery>({
    queryKey: queryKeys.expected.detail(expectedParam),
    queryFn: () => expectedApi.get(expectedParam as string),
    fallbackError: text.failed,
    enabled: expectedParam != null,
  })
  const openOrders = useApiQuery<PageResponse<ExpectedDelivery>>({
    queryKey: ['expected', 'list', 'receive', vendorId],
    queryFn: () => expectedApi.list({ view: 'OPEN', vendorId, page: 0, size: 5 }),
    fallbackError: text.failed,
    enabled: vendorId !== '',
    persist: false,
  })
  // Newest first; only those still owed something. The one opened from its own page is always offered.
  const orders = useMemo(() => {
    const listed = (openOrders.data?.content ?? []).filter((order) => order.receivable)
    const linked = fromLink.data
    if (linked && linked.receivable && linked.vendorId === vendorId && !listed.some((order) => order.id === linked.id)) {
      return [linked, ...listed]
    }
    return listed
  }, [openOrders.data, fromLink.data, vendorId])
  const order = orders.find((entry) => entry.id === orderId) ?? null

  // ---------------------------------------------------------------- the draft --------------
  const draft = useDraft<ReceiveDraftV2>(`delivery:${expectedParam ?? 'new'}`)
  const [restoredDraft, setRestoredDraft] = useState(false)
  const { initial: initialDraft, save: saveDraftNow } = draft
  const started = useRef(false)
  useEffect(() => {
    if (!initialDraft || started.current) return
    const saved = initialDraft.value
    // A draft from the old screen kept its lines another way: it can't be put back.
    if (saved.version !== 2) {
      void draft.clear()
      return
    }
    started.current = true
    setVendorId(saved.vendorId)
    setOrderId(saved.orderId)
    setRows(saved.rows)
    setDeliveryDate(saved.deliveryDate > todayIso() ? todayIso() : saved.deliveryDate)
    setInvoiceNo(saved.invoiceNo)
    setRestoredDraft(true)
    setTouched(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDraft])
  useEffect(() => {
    if (initialDraft === undefined || recorded || !touched) return
    if (rows.length === 0 && invoiceNo.trim() === '') return
    saveDraftNow({ version: 2, vendorId, orderId, rows, deliveryDate, invoiceNo })
  }, [initialDraft, recorded, touched, saveDraftNow, vendorId, orderId, rows, deliveryDate, invoiceNo])

  // Opened from an order ("Record what arrived"): its supplier, and that order chosen.
  useEffect(() => {
    const linked = fromLink.data
    if (!linked || started.current) return
    started.current = true
    if (linked.vendorId) setVendorId(linked.vendorId)
    setOrderId(linked.id)
    setRows(rowsFor(linked))
    if (linked.reference) setInvoiceNo(linked.reference)
  }, [fromLink.data])

  // A supplier picked by hand: their newest open order is chosen, or "not on an order" when none.
  useEffect(() => {
    if (vendorId === '' || orderId !== '' || !openOrders.data) return
    const newest = orders[0]
    if (newest) {
      setOrderId(newest.id)
      setRows((current) => [...rowsFor(newest), ...current.filter((row) => row.ordered == null)])
    } else {
      setOrderId(NONE)
    }
  }, [vendorId, orderId, openOrders.data, orders])

  function chooseSupplier(next: string) {
    setTouched(true)
    setVendorId(next)
    setOrderId('')
    setRows([])
    setAdding(false)
  }

  function chooseOrder(next: string) {
    setTouched(true)
    setOrderId(next)
    const chosen = orders.find((entry) => entry.id === next)
    // Anything added that isn't on an order stays; the order's own lines are swapped.
    setRows((current) => [...(chosen ? rowsFor(chosen) : []), ...current.filter((row) => row.ordered == null)])
  }

  // ---------------------------------------------------------------- lines ------------------
  function patchRow(key: string, patch: Partial<ReceiveRow>) {
    setTouched(true)
    setRows((current) => current.map((row) => (rowKey(row) === key ? { ...row, ...patch } : row)))
  }
  function patchBack(key: string, patch: Partial<SendBack>) {
    setTouched(true)
    setRows((current) => current.map((row) => (rowKey(row) === key ? { ...row, back: { ...row.back, ...patch } } : row)))
  }
  function addLine(line: DeliveryLine) {
    setTouched(true)
    const key = lineKey(line)
    setRows((current) => (current.some((row) => rowKey(row) === key) ? current : [...current, rowFor(line)]))
    setSearch('')
    window.setTimeout(() => document.getElementById(`arrived-${key}`)?.focus(), 50)
  }
  function removeLine(key: string) {
    setRows((current) => current.filter((row) => rowKey(row) !== key))
  }

  // What can be added: the supplier's own products first ("From Tony before"), else anything searched.
  const supplierLines = useDeliveryLines('BY_VENDOR', vendorId || undefined)
  const allLines = useDeliveryLines('ALL')
  const onScreen = new Set(rows.map(rowKey))
  const searching = search.trim() !== ''
  const addable = (searching ? (allLines.lines ?? []).filter((line) => matchesSearch(line, search)) : (supplierLines.lines ?? []))
    .filter((line) => !onScreen.has(lineKey(line)))
    .slice(0, SHOWN_SUGGESTIONS)
  const noOrder = orderId === NONE || vendorId === ''
  const showAdder = adding || (noOrder && rows.length === 0)

  // ---------------------------------------------------------------- the button -------------
  const tally = tallyRows(rows)
  const today = todayIso()
  const dateBad = deliveryDate === '' || deliveryDate > today
  const canSubmit = tally.count > 0 && !tally.invalid && !dateBad && online && !submitting
  const priced = rows.filter((row) => row.ordered != null && row.orderPrice != null)
  const changedPrices = priced.filter((row) => amount(row.price) != null && amount(row.price) !== row.orderPrice).length
  const pricesWord =
    order && priced.length > 0
      ? changedPrices > 0
        ? text.pricesChanged(changedPrices)
        : text.pricesAsOrder(order.poNumber ?? order.title)
      : text.pricesLast

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    let sessionId: string
    try {
      const session = await importsApi.createDelivery({
        deliveryDate,
        invoiceNo: invoiceNo.trim() || undefined,
        vendorId: vendorId || undefined,
        expectedDeliveryId: order?.id,
        lines: tally.lines,
      })
      sessionId = session.id
      // A line the server can't take, or one it wants looked at, goes to the full review: it has the fixes.
      if (session.errorCount > 0 || session.warningCount > 0) {
        await draft.finish()
        navigate(`/app/products/import/${session.id}`)
        return
      }
    } catch (err: unknown) {
      setError(isAppError(err) ? err.message : text.failed)
      setSubmitting(false)
      return
    }
    try {
      await importsApi.commit(sessionId)
      await draft.finish()
      void invalidateInventory(queryClient)
      void queryClient.invalidateQueries({ queryKey: queryKeys.expected.all })
      const what = rows
        .filter((row) => row.arrived.trim() !== '' && (amount(row.arrived) ?? 0) > 0)
        .map((row) => ({ row, taken: Math.max(0, (amount(row.arrived) ?? 0) - (row.back.open ? (amount(row.back.quantity) ?? 0) : 0)) }))
        .filter(({ taken }) => taken > 0)
        .map(({ row, taken }) => `${words(row, taken)} of ${row.line.productName.toLowerCase()}`)
        .join(', ')
      const after = order ? await expectedApi.get(order.id).catch(() => null) : null
      setRecorded({ importId: sessionId, what, order: after })
    } catch (err: unknown) {
      setError(isAppError(err) ? err.message : text.commitFailed)
    } finally {
      setSubmitting(false)
    }
  }

  if (recorded) {
    return <AfterRecording recorded={recorded} canSend={canSend} onAnother={() => navigate('/app/products/receive', { replace: true })} />
  }

  const loadingLinked = expectedParam != null && fromLink.loading && !fromLink.data
  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{text.title}</h1>
          <Link
            to={SPREADSHEET_PATH}
            className="mt-1 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
          >
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            {text.useSheet}
          </Link>
        </div>

        <DraftNote
          savedAt={draft.savedAt}
          restored={restoredDraft}
          onDiscard={() => {
            void draft.clear()
            setRestoredDraft(false)
            setRows([])
            setOrderId('')
            setInvoiceNo('')
            setDeliveryDate(todayIso())
          }}
        />

        {loadingLinked ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          canSeeSuppliers && (
            <SupplierSearch
              vendors={vendors}
              recent={recent}
              value={vendorId}
              onChange={chooseSupplier}
              canCreate={canManageSuppliers}
              onCreated={addVendor}
              disabled={submitting}
              label={text.whoFrom}
            />
          )
        )}

        {/* "Which order is this?" — the newest is chosen; the person at the gate can see what each holds. */}
        {vendorId !== '' && orders.length > 0 && (
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-sm font-semibold text-neutral-900">{text.whichOrder}</legend>
            <div className="divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200 bg-white">
              {orders.map((entry) => (
                <OrderChoice key={entry.id} order={entry} chosen={orderId === entry.id} onChoose={() => chooseOrder(entry.id)} />
              ))}
              <label className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 ${orderId === NONE ? 'bg-primary-50' : ''}`}>
                <input type="radio" name="receive-order" checked={orderId === NONE} onChange={() => chooseOrder(NONE)} className="h-4 w-4 accent-primary-700" />
                <span className="text-sm font-semibold text-neutral-900">{text.notOnOrder}</span>
              </label>
            </div>
          </fieldset>
        )}
        {vendorId !== '' && openOrders.data && orders.length === 0 && (
          <p className="text-sm text-neutral-600">{text.noOrdersOpen(supplierName)}</p>
        )}

        {(vendorId !== '' || !canSeeSuppliers) && (
          <section aria-labelledby="receive-lines-heading" className="flex flex-col gap-2">
            <h2 id="receive-lines-heading" className="text-sm font-semibold text-neutral-900">
              {text.whatArrived}
            </h2>
            {rows.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-b border-neutral-200 px-3 py-1.5 text-xs text-neutral-500 sm:px-4">
                  <span>{text.product}</span>
                  <span className="text-right">{text.ordered}</span>
                  <span className="w-16 text-center">{text.arrived}</span>
                </div>
                <ul className="divide-y divide-neutral-100" data-on-order>
                  {rows.map((row) => {
                    const key = rowKey(row)
                    return (
                      <ReceiveLineRow
                        key={key}
                        id={`arrived-${key}`}
                        row={row}
                        disabled={submitting}
                        onArrived={(typed) => patchRow(key, { arrived: typed })}
                        onBack={(patch) => patchBack(key, patch)}
                        onRemove={row.ordered == null ? () => removeLine(key) : undefined}
                      />
                    )
                  })}
                </ul>
              </div>
            )}
            {order && rows.some((row) => row.ordered != null) && <p className="text-xs text-neutral-600">{text.changeHint}</p>}

            {!showAdder && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="self-start rounded-sm text-sm font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
              >
                {text.somethingElse}
              </button>
            )}
            {showAdder && (
              <div className="flex flex-col gap-2">
                <BarcodeScanField disabled={submitting} onFound={(found) => found[0] && addLine(found[0])} />
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
                  <label htmlFor="receive-search" className="sr-only">
                    {text.addSearch}
                  </label>
                  <input
                    id="receive-search"
                    type="search"
                    value={search}
                    autoComplete="off"
                    placeholder={text.addSearch}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full rounded-md border border-neutral-200 bg-white py-2.5 pr-3 pl-9 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none sm:text-sm"
                  />
                </div>
                {!searching && vendorId !== '' && addable.length > 0 && (
                  <h3 className="text-xs font-medium text-neutral-600">{text.addFrom(supplierName)}</h3>
                )}
                {searching && allLines.lines && addable.length === 0 && <p className="text-sm text-neutral-600">{text.noMatch(search.trim())}</p>}
                {(searching ? allLines.loading : supplierLines.loading) && !(searching ? allLines.lines : supplierLines.lines) && (
                  <Skeleton className="h-14 w-full" />
                )}
                {addable.length > 0 && (
                  <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
                    {addable.map((line) => (
                      <li key={lineKey(line)} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-neutral-900">{line.productName}</span>
                          <span className="block text-xs text-neutral-600">{line.comesIn}</span>
                        </span>
                        <Button variant="secondary" onClick={() => addLine(line)} aria-label={text.addLabel(line.productName, line.comesIn)}>
                          {text.add}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        )}

        {rows.length > 0 && (
          <section className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white text-sm">
            <ShortLine
              label={text.arrivedOn}
              value={deliveryDate === today ? text.today : shortDate(deliveryDate)}
              action={text.change}
              open={open === 'date'}
              onToggle={() => setOpen(open === 'date' ? null : 'date')}
            >
              <input
                id="receive-date"
                type="date"
                value={deliveryDate}
                max={today}
                onChange={(event) => setDeliveryDate(event.target.value)}
                aria-label={text.arrivedOn}
                aria-invalid={dateBad || undefined}
                className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-base sm:text-sm"
              />
              {dateBad && <p className="text-xs text-danger-700">{text.dateFuture}</p>}
            </ShortLine>
            <ShortLine
              label={text.waybill}
              value={invoiceNo.trim() || text.none}
              muted={invoiceNo.trim() === ''}
              action={invoiceNo.trim() ? text.change : text.addWord}
              open={open === 'invoice'}
              onToggle={() => setOpen(open === 'invoice' ? null : 'invoice')}
            >
              <input
                id="receive-invoice"
                type="text"
                maxLength={200}
                autoFocus
                value={invoiceNo}
                onChange={(event) => setInvoiceNo(event.target.value)}
                aria-label={text.waybill}
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-base sm:text-sm"
              />
            </ShortLine>
            <ShortLine
              label={text.prices}
              value={pricesWord}
              action={text.change}
              open={open === 'prices'}
              onToggle={() => setOpen(open === 'prices' ? null : 'prices')}
            >
              <ul className="flex flex-col gap-2">
                {rows
                  .filter((row) => (amount(row.arrived) ?? 0) > 0)
                  .map((row) => (
                    <PriceLine
                      key={rowKey(row)}
                      row={row}
                      poNumber={order?.poNumber ?? ''}
                      onPrice={(typed) => patchRow(rowKey(row), { price: typed })}
                      onSendBack={() => patchBack(rowKey(row), { open: true, reason: 'PRICE', quantity: row.arrived })}
                    />
                  ))}
              </ul>
            </ShortLine>
          </section>
        )}

        {error && <ErrorState variant="inline" message={error} />}
      </div>

      <div className="sticky -bottom-6 z-10 -mx-6 mt-6 -mb-6 border-t border-neutral-200 bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-col gap-1">
          <Button variant="action" className="w-full" disabled={!canSubmit} loading={submitting} onClick={() => void handleSubmit()}>
            {submitting ? text.saving : tally.count === 0 ? text.recordEmpty : !online ? text.recordOffline : text.record(tally.count)}
          </Button>
          {!online && tally.count > 0 && <p className="text-center text-xs text-neutral-600">{text.offline}</p>}
          {online && (tally.short > 0 || tally.goingBack.length > 0) && (
            <p className="text-center text-xs text-neutral-600" aria-live="polite">
              {[tally.short > 0 ? text.linesShort(tally.short) : null, tally.goingBack.length > 0 ? text.goesBack(tally.goingBack.join(', ')) : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function OrderChoice({ order, chosen, onChoose }: { order: ExpectedDelivery; chosen: boolean; onChoose: () => void }) {
  const owed = order.lines.filter((line) => line.outstanding > 0)
  const what = owed.slice(0, 3).map((line) => line.productName).join(', ') + (owed.length > 3 ? ` +${owed.length - 3}` : '')
  return (
    <label className={`flex cursor-pointer items-start gap-3 px-4 py-2.5 ${chosen ? 'bg-primary-50' : ''}`}>
      <input type="radio" name="receive-order" checked={chosen} onChange={onChoose} className="mt-0.5 h-4 w-4 accent-primary-700" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-neutral-900">
          {order.poNumber ?? order.title} · {text.orderMade(shortDate(order.createdAt.slice(0, 10)), order.createdByName ?? null)}
        </span>
        <span className="block text-xs text-neutral-600">{what}</span>
      </span>
    </label>
  )
}

function ShortLine({
  label,
  value,
  muted,
  action,
  open,
  onToggle,
  children,
}: {
  label: string
  value: string
  muted?: boolean
  action: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="px-4 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-baseline gap-3">
          <span className="w-24 shrink-0 text-xs text-neutral-500">{label}</span>
          <span className={`min-w-0 truncate ${muted ? 'text-neutral-500' : 'text-neutral-900'}`}>{value}</span>
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="shrink-0 rounded-sm font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
        >
          {open ? text.done : action}
        </button>
      </div>
      {open && <div className="mt-2 flex flex-col gap-1.5">{children}</div>}
    </div>
  )
}

/** One price in the Prices panel; a price other than the order's says so, beside the order's (mockup 5B). */
function PriceLine({
  row,
  poNumber,
  onPrice,
  onSendBack,
}: {
  row: ReceiveRow
  poNumber: string
  onPrice: (typed: string) => void
  onSendBack: () => void
}) {
  const id = `price-${rowKey(row)}`
  const typed = amount(row.price)
  const shown = priceOf(row)
  const differs = row.orderPrice != null && typed != null && typed !== row.orderPrice
  const taken = Math.max(0, (amount(row.arrived) ?? 0) - (row.back.open ? (amount(row.back.quantity) ?? 0) : 0))
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="min-w-0 text-sm text-neutral-800">
          {row.line.productName} <span className="text-xs text-neutral-500">{perUnitWords(row.line)}</span>
        </label>
        <span className="flex items-center rounded-md border border-neutral-200 bg-white focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100">
          <span className="pl-2.5 text-neutral-500" aria-hidden="true">
            ₦
          </span>
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={row.price}
            placeholder={shown != null ? new Intl.NumberFormat('en-NG').format(shown) : ''}
            onChange={(event) => onPrice(event.target.value)}
            className="w-24 bg-transparent py-1.5 pr-2.5 pl-1 text-right text-base font-semibold tabular-nums focus:outline-none sm:text-sm"
          />
        </span>
      </div>
      {differs && row.orderPrice != null && typed != null && (
        <p className="flex flex-wrap items-center gap-x-2 rounded-md bg-warning-50 px-2.5 py-1.5 text-xs text-warning-800">
          <span className="font-semibold">{text.onTheOrder(orderMoney(row.orderPrice))}</span>
          {typed > row.orderPrice && taken > 0 && <span>· {text.moreFor(orderMoney((typed - row.orderPrice) * taken), words(row, taken))}</span>}
          <span className="basis-full">{text.priceDiffers(poNumber)}</span>
          <button
            type="button"
            onClick={onSendBack}
            className="rounded-sm font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
          >
            {text.sendItBack}
          </button>
        </p>
      )}
    </li>
  )
}

/** After it went in (mockups D, 5C): what is now in stock, and — if anything is still owed — is it still coming? */
function AfterRecording({ recorded, canSend, onAnother }: { recorded: Recorded; canSend: boolean; onAnother: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [choice, setChoice] = useState<'keep' | 'close' | 'later'>('keep')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const order = recorded.order
  const owed = order && order.status === 'OPEN' ? order.lines.filter((line) => line.outstanding > 0) : []
  const po = order?.poNumber ?? order?.title ?? ''
  const sentBack = new Set(
    (order?.receipts ?? []).find((receipt) => receipt.importId === recorded.importId)?.sentBack?.map((back) => `${back.productId}|${back.unit}`) ?? [],
  )
  const owedWhat = owed.map((line) => `${quantityWords(line.outstanding, line.comesIn).replace(/ \(.*\)$/, '')} of ${line.productName.toLowerCase()}`).join(', ')
  const wentBack = owed.length > 0 && owed.every((line) => sentBack.has(`${line.productId}|${line.unit}`))
  const orderHref = order ? `/app/purchase-orders/${order.id}` : null

  async function finish() {
    if (!order) return
    if (choice === 'close' && canSend) {
      setBusy(true)
      setError(null)
      try {
        await expectedApi.cancel(order.id)
        void queryClient.invalidateQueries({ queryKey: queryKeys.expected.all })
      } catch (err: unknown) {
        setError(isAppError(err) ? err.message : text.failed)
        setBusy(false)
        return
      }
    }
    navigate(`/app/purchase-orders/${order.id}`, { replace: true })
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-semibold text-neutral-900">{text.title}</h1>
      <p className="flex items-start gap-2 rounded-md bg-accent-50 px-3 py-2.5 text-sm text-accent-800" role="status">
        <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {text.recorded(recorded.what)}
      </p>

      {order && owed.length > 0 && (
        <fieldset className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
          <legend className="sr-only">{text.stillComing(owedWhat)}</legend>
          <p className="font-semibold text-neutral-900">
            {wentBack ? text.comeAgain(owedWhat) : text.stillComing(text.cameShort(owedWhat))}
          </p>
          <div className="divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
            {(
              [
                ['keep', text.keepOpen(po, owedWhat)],
                ...(canSend ? [['close', text.closeIt(po)]] : []),
                ['later', text.decideLater],
              ] as [typeof choice, string][]
            ).map(([value, label]) => (
              <label key={value} className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm ${choice === value ? 'bg-primary-50' : ''}`}>
                <input type="radio" name="still-coming" checked={choice === value} onChange={() => setChoice(value)} className="h-4 w-4 accent-primary-700" />
                <span className="font-medium text-neutral-900">{label}</span>
              </label>
            ))}
          </div>
          {!canSend && <p className="text-xs text-neutral-600">{text.closeNeedsSend}</p>}
          <Button variant="action" className="w-full" loading={busy} onClick={() => void finish()}>
            {text.done}
          </Button>
          {error && <p role="alert" className="text-sm text-danger-700">{error}</p>}
        </fieldset>
      )}
      {order && owed.length === 0 && <p className="text-sm text-neutral-700">{text.complete(po)}</p>}

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {orderHref && owed.length === 0 && (
          <Link to={orderHref} className={buttonClassName('secondary')}>
            {text.openOrder(po)}
          </Link>
        )}
        <Link
          to={`/app/products/import/${recorded.importId}/result`}
          className="self-center rounded-sm font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
        >
          {text.seeRecorded}
        </Link>
        <button
          type="button"
          onClick={onAnother}
          className="self-center rounded-sm font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
        >
          {text.another}
        </button>
      </div>
    </div>
  )
}
