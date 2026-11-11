import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { Button, buttonClassName } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { useApiQuery } from '@/data/useApiQuery'
import {
  priceRequestsApi,
  type Pick,
  type PickedItem,
  type PriceRequest,
  type PriceRequestLine,
  type PriceRequestSupplier,
} from '@/features/expected/api/priceRequestsApi'
import { orderMoney, quantityWords, shortDate, whenText } from '@/features/expected/expected'
import { quantityUnitWord } from '@/features/imports/delivery'
import { isAppError } from '@/types/api'

const LIST_PATH = '/app/purchase-orders'

const text = {
  list: 'Purchase orders',
  asking: (rfq: string) => `${rfq} · Asking for prices`,
  replied: (rfq: string, done: number, all: number) => `${rfq} · ${done} of ${all} replied`,
  done: (rfq: string) => `${rfq} · Done`,
  closed: (rfq: string) => `${rfq} · Closed`,
  repliesClose: (day: string) => `Replies close ${day}`,
  repliesClosed: (day: string) => `Replies closed ${day}`,
  changeDay: 'Change',
  moreTime: 'Give more time',
  newDay: 'Replies close on',
  saveDay: 'Save',
  sentHeading: (sent: number, all: number) => `Sent to ${sent} of ${all}`,
  sharedWhatsApp: (when: string) => `Shared on WhatsApp · ${when}`,
  copied: (when: string) => `Message copied · ${when}`,
  emailed: (when: string) => `Email sent · ${when}`,
  notSent: 'Not sent yet',
  sendWhatsApp: 'Send on WhatsApp',
  copy: 'Copy message',
  copiedNow: 'Copied',
  sendAgain: 'Send again',
  linkNote: "Each supplier gets their own link to type in their prices. You'll get a notification as each one replies.",
  pricesHeading: 'Their prices',
  sentPrices: (when: string) => `Sent prices · ${when}`,
  typedByYou: (when: string) => `Typed by you · ${when}`,
  changed: 'changed since',
  opened: (when: string) => `Opened the link · ${when} · no reply yet`,
  notIn: 'Not in yet',
  declined: "Can't do it",
  addPrices: (name: string) => `Add ${name}'s prices`,
  changePrices: 'Change',
  compare: 'Compare prices',
  lowest: 'Lowest',
  noReply: 'No reply',
  cantSupply: "Can't supply",
  delivery: 'Delivery',
  free: 'Free',
  notSaid: 'not said',
  byDay: (day: string) => `by ${day}`,
  late: (day: string) => `${day}, after you need it`,
  notes: 'Their notes',
  choose: 'Choose who to order from',
  chooseHint: 'Each item starts on the lowest price. Tap another supplier to order from them instead.',
  cheapestAll: 'Cheapest for each',
  allFrom: (name: string) => `All from ${name}`,
  notNow: 'Not now',
  more: (amount: string) => `+${amount}`,
  ordered: 'Ordered',
  dearer: (name: string, amount: string, lowest: string, lowestName: string) =>
    `Ordered from ${name} at ${amount} · lowest was ${lowest} from ${lowestName}`,
  summary: (parts: string) => parts,
  supplierItems: (name: string, count: number) => `${name} ${count === 1 ? '1 item' : `${count} items`}`,
  inclDelivery: (amount: string) => `incl. ${amount} delivery`,
  moreThanCheapest: (amount: string) => `${amount} more than the cheapest`,
  pickOne: 'Pick a supplier for at least one item',
  make: (count: number) => (count === 1 ? 'Make the purchase order' : `Make ${count} purchase orders`),
  makeNote: 'You can still change them before they are sent.',
  dontWait: (names: string) => `You don't have to wait for ${names}`,
  becameOrders: 'It became',
  closeLink: 'Close without ordering',
  closeAsk: 'Close this request? Suppliers who open the link will see it is closed.',
  closeYes: 'Close it',
  closeNo: 'Keep it open',
  failed: "That didn't go through. Try again.",
  loadFailed: "We couldn't load that price request.",
  // Typed reply
  pricesOf: (name: string) => `${name}'s prices`,
  typedTag: 'typed by you',
  per: (unit: string) => `per ${unit}`,
  cantSupplyToggle: "Can't supply",
  canSupplyToggle: 'Can supply after all',
  deliveryTo: 'Delivery',
  theirNote: 'Their note (optional)',
  save: (name: string) => `Save ${name}'s prices`,
  cantDoIt: (name: string) => `${name} can't do it`,
  cancel: 'Cancel',
}

/**
 * One price request (PURCHASE_ORDER_PLAN.md section 11.3; mockups 1C, 1H, 1I, 1J): who it went to,
 * each supplier's reply and remark in their own words, the comparison, and the choice that turns it
 * into purchase orders. The buyer doesn't have to wait for every reply.
 */
export function PriceRequestPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const permissions = user?.type === 'tenant' ? user.permissions : []
  const canAct = permissions.includes(PERMISSIONS.SEND_PURCHASE_ORDER) || permissions.includes(PERMISSIONS.CREATE_PURCHASE_ORDER)

  const result = useApiQuery<PriceRequest>({
    queryKey: ['price-requests', 'detail', id],
    queryFn: () => priceRequestsApi.get(id),
    fallbackError: text.loadFailed,
  })
  const request = result.data ?? null
  const { setData } = result

  const [typing, setTyping] = useState<string | null>(null)
  // The buyer's picks, item by item (plan section 12.2); an item not touched stays on the lowest.
  const [overrides, setOverrides] = useState<Record<string, string | null>>({})
  const [editingDay, setEditingDay] = useState(false)
  const [busy, setBusy] = useState(false)
  const [askClose, setAskClose] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function adopt(next: PriceRequest) {
    setData(next)
    void queryClient.invalidateQueries({ queryKey: ['price-requests', 'list'] })
  }

  async function shared(supplier: PriceRequestSupplier, channel: 'WHATSAPP' | 'MESSAGE') {
    try {
      adopt(await priceRequestsApi.shared(id, supplier.id, channel))
    } catch {
      // Writing it down is a nicety; it never gets in the way of sending.
    }
  }

  async function copyMessage(supplier: PriceRequestSupplier) {
    if (!supplier.message) return
    try {
      await navigator.clipboard.writeText(supplier.message)
      setCopied(supplier.id)
      window.setTimeout(() => setCopied(null), 2000)
      void shared(supplier, 'MESSAGE')
    } catch {
      setError(text.failed)
    }
  }

  if (result.loading && !request) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4" role="status" aria-busy="true">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  if (!request) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <ErrorState title={text.loadFailed} message={result.error ?? text.loadFailed} onRetry={result.refetch} />
      </div>
    )
  }

  const open = request.status === 'OPEN'
  const replied = request.suppliers.filter((supplier) => supplier.status === 'REPLIED')
  const answered = request.suppliers.filter((supplier) => supplier.status === 'REPLIED' || supplier.status === 'DECLINED')
  const sent = request.suppliers.filter((supplier) => supplier.sentAt != null || supplier.status === 'REPLIED' || supplier.status === 'DECLINED')
  const title =
    request.status === 'DONE'
      ? text.done(request.rfqNumber)
      : request.status === 'CLOSED'
        ? text.closed(request.rfqNumber)
        : answered.length > 0
          ? text.replied(request.rfqNumber, answered.length, request.suppliers.length)
          : text.asking(request.rfqNumber)
  const what = request.lines.map((line) => `${line.productName} ${quantityWords(line.quantity, line.comesIn).replace(/ \(.*\)$/, '')}`).join(', ')
  const choosing = open && canAct && replied.length > 0
  const priceOf = (supplierId: string | null | undefined, lineId: string) =>
    request.suppliers.find((supplier) => supplier.id === supplierId)?.quotes.find((quote) => quote.lineId === lineId)?.price ?? null
  // A pick of a supplier who no longer prices that item (they changed their reply) falls back to the lowest.
  const pickOf = (lineId: string): string | null => {
    if (lineId in overrides) {
      const chosen = overrides[lineId]
      if (chosen == null || priceOf(chosen, lineId) != null) return chosen
    }
    return request.lowestByLine[lineId] ?? null
  }
  const plan = summarise(request, pickOf)
  const waitingFor = request.suppliers.filter((supplier) => supplier.status !== 'REPLIED' && supplier.status !== 'DECLINED').map((s) => s.vendorName)

  const lines = request.lines
  async function make() {
    if (plan.orders.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const picks: Pick[] = lines.map((line) => ({ lineId: line.id, supplierId: pickOf(line.id) }))
      const made = await priceRequestsApi.choose(id, picks)
      void queryClient.invalidateQueries({ queryKey: ['price-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['expected'] })
      navigate(made.orderIds.length === 1 ? `${LIST_PATH}/${made.orderIds[0]}` : `${LIST_PATH}/rfq/${id}`, { replace: made.orderIds.length === 1 })
      if (made.orderIds.length !== 1) adopt(await priceRequestsApi.get(id))
    } catch (err: unknown) {
      setError(isAppError(err) ? err.message : text.failed)
    } finally {
      setBusy(false)
    }
  }

  async function close() {
    setBusy(true)
    try {
      adopt(await priceRequestsApi.close(id))
      setAskClose(false)
    } catch (err: unknown) {
      setError(isAppError(err) ? err.message : text.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
        <div>
          <Breadcrumbs items={[{ label: text.list, to: `${LIST_PATH}?view=RFQ` }, { label: request.rfqNumber }]} />
          <h1 className="mt-2 text-2xl font-semibold text-neutral-900">{title}</h1>
          <p className="mt-1 text-sm text-neutral-600">{what}</p>
          {open && request.replyBy && (
            <ReplyByLine
              request={request}
              canAct={canAct}
              editing={editingDay}
              onEdit={setEditingDay}
              onSaved={(next) => {
                adopt(next)
                setEditingDay(false)
              }}
            />
          )}
        </div>

        {request.status === 'DONE' && (
          <section className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4">
            <p className="font-semibold text-neutral-900">{text.becameOrders}</p>
            <ul className="flex flex-wrap gap-2">
              {request.suppliers
                .filter((supplier) => supplier.orderId)
                .map((supplier) => (
                  <li key={supplier.id}>
                    <Link to={`${LIST_PATH}/${supplier.orderId}`} className={buttonClassName('secondary')}>
                      {supplier.orderNumber} · {supplier.vendorName}
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        )}

        {/* Sending, while someone hasn't answered yet; once all have, there's nothing to do here. */}
        {open && answered.length < request.suppliers.length && (
          <section aria-labelledby="rfq-sent" className="flex flex-col gap-2">
            <h2 id="rfq-sent" className="text-sm font-semibold text-neutral-900">
              {text.sentHeading(sent.length, request.suppliers.length)}
            </h2>
            <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
              {request.suppliers.map((supplier) => {
                const wasSent = supplier.sentAt != null
                const line = supplier.sentAt
                  ? (supplier.sentVia === 'WHATSAPP' ? text.sharedWhatsApp : supplier.sentVia === 'EMAIL' ? text.emailed : text.copied)(whenText(supplier.sentAt))
                  : supplier.phone ?? text.notSent
                return (
                  <li key={supplier.id} className="flex flex-col gap-2 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-neutral-900">{supplier.vendorName}</span>
                        <span className="block text-xs text-neutral-600">{line}</span>
                      </span>
                      {wasSent && <Check className="h-4 w-4 shrink-0 text-accent-600" aria-label="sent" />}
                    </div>
                    {canAct && !request.repliesClosed && supplier.status !== 'REPLIED' && supplier.status !== 'DECLINED' && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                        {supplier.whatsappUrl && (
                          <a
                            href={supplier.whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => void shared(supplier, 'WHATSAPP')}
                            className={wasSent ? linkClass : buttonClassName('action')}
                          >
                            {wasSent ? text.sendAgain : text.sendWhatsApp}
                          </a>
                        )}
                        <button type="button" onClick={() => void copyMessage(supplier)} className={linkClass}>
                          {copied === supplier.id ? text.copiedNow : text.copy}
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            {sent.length === 0 && <p className="rounded-md bg-primary-50 px-3 py-2 text-sm text-neutral-800">{text.linkNote}</p>}
          </section>
        )}

        <section aria-labelledby="rfq-prices" className="flex flex-col gap-2">
          <h2 id="rfq-prices" className="text-sm font-semibold text-neutral-900">
            {text.pricesHeading}
          </h2>
          <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
            {request.suppliers.map((supplier) =>
              typing === supplier.id ? (
                <li key={supplier.id} className="px-4 py-3">
                  <TypedReply
                    request={request}
                    supplier={supplier}
                    onSaved={(next) => {
                      adopt(next)
                      setTyping(null)
                    }}
                    onCancel={() => setTyping(null)}
                  />
                </li>
              ) : (
                <li key={supplier.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-neutral-900">{supplier.vendorName}</span>
                    <span className="block text-xs text-neutral-600">
                      {supplier.status === 'REPLIED' && supplier.repliedAt
                        ? (supplier.replySource === 'TYPED' ? text.typedByYou : text.sentPrices)(whenText(supplier.repliedAt))
                        : supplier.status === 'DECLINED'
                          ? text.declined
                          : supplier.openedAt
                            ? text.opened(whenText(supplier.openedAt))
                            : text.notIn}
                      {supplier.status === 'REPLIED' && supplier.total != null && (
                        <>
                          {' · '}
                          <b className="font-semibold text-neutral-900 tabular-nums">{orderMoney(supplier.total)}</b>
                        </>
                      )}
                    </span>
                  </span>
                  {open && canAct && (
                    <Button variant="secondary" onClick={() => setTyping(supplier.id)}>
                      {supplier.status === 'REPLIED' ? text.changePrices : text.addPrices(supplier.vendorName.split(' ')[0])}
                    </Button>
                  )}
                </li>
              ),
            )}
          </ul>
        </section>

        {replied.length > 0 &&
          (choosing ? (
            <Choose
              request={request}
              pickOf={pickOf}
              onPick={(lineId, supplierId) => setOverrides((all) => ({ ...all, [lineId]: supplierId }))}
              onPickAll={(next) => setOverrides(next)}
            />
          ) : (
            <Compare request={request} />
          ))}
        {choosing && waitingFor.length > 0 && <p className="-mt-4 text-xs text-neutral-600">{text.dontWait(waitingFor.join(', '))}</p>}

        {open && canAct && (
          <div className="text-sm">
            {!askClose ? (
              <button type="button" onClick={() => setAskClose(true)} className={linkClass}>
                {text.closeLink}
              </button>
            ) : (
              <div className="flex flex-col gap-2 rounded-md bg-neutral-50 p-3">
                <p className="text-neutral-800">{text.closeAsk}</p>
                <div className="flex gap-2">
                  <Button variant="secondary" loading={busy} onClick={() => void close()}>
                    {text.closeYes}
                  </Button>
                  <Button variant="quiet" onClick={() => setAskClose(false)}>
                    {text.closeNo}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        {error && <ErrorState variant="inline" message={error} />}
      </div>

      {choosing && (
        // What the picks will make, always in view (plan section 12.2): who, how many, the total and its delivery.
        <div className="sticky -bottom-6 z-10 -mx-6 mt-6 -mb-6 border-t border-neutral-200 bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur" data-choose-summary>
          <div className="mx-auto flex max-w-2xl flex-col gap-2">
            {plan.orders.length > 0 && (
              <div className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-neutral-900">{plan.orders.map((order) => text.supplierItems(order.name, order.items)).join(' · ')}</p>
                  <p className="text-xs text-neutral-600">
                    {[
                      plan.delivery > 0 ? text.inclDelivery(orderMoney(plan.delivery)) : null,
                      plan.overCheapest > 0 ? text.moreThanCheapest(orderMoney(plan.overCheapest)) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <p className="shrink-0 font-semibold text-neutral-900 tabular-nums">{orderMoney(plan.total)}</p>
              </div>
            )}
            <Button variant="action" className="w-full" loading={busy} disabled={plan.orders.length === 0} onClick={() => void make()}>
              {plan.orders.length === 0 ? text.pickOne : text.make(plan.orders.length)}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * What the picks will make (plan section 12.2): one order per supplier picked, its items, and the total - each
 * supplier's delivery charge counted once - beside what the cheapest for the same items would cost.
 */
function summarise(request: PriceRequest, pickOf: (lineId: string) => string | null) {
  const byId = new Map(request.suppliers.map((supplier) => [supplier.id, supplier]))
  const amountOf = (supplierId: string, lineId: string) =>
    byId.get(supplierId)?.quotes.find((quote) => quote.lineId === lineId)?.amount ?? 0
  const orders = new Map<string, { name: string; items: number; amount: number }>()
  let cheapest = 0
  const cheapestFrom = new Set<string>()
  for (const line of request.lines) {
    const picked = pickOf(line.id)
    if (picked == null) continue
    const order = orders.get(picked) ?? { name: byId.get(picked)?.vendorName ?? '', items: 0, amount: 0 }
    order.items += 1
    order.amount += amountOf(picked, line.id)
    orders.set(picked, order)
    const lowest = request.lowestByLine[line.id]
    if (lowest) {
      cheapest += amountOf(lowest, line.id)
      cheapestFrom.add(lowest)
    }
  }
  const charge = (supplierId: string) => byId.get(supplierId)?.deliveryCharge ?? 0
  const delivery = [...orders.keys()].reduce((sum, supplierId) => sum + charge(supplierId), 0)
  const total = [...orders.values()].reduce((sum, order) => sum + order.amount, 0) + delivery
  cheapest += [...cheapestFrom].reduce((sum, supplierId) => sum + charge(supplierId), 0)
  return { orders: [...orders.values()], delivery, total, overCheapest: Math.max(0, Math.round((total - cheapest) * 100) / 100) }
}

/**
 * "Replies close Mon 10 Nov · Change" / "Replies closed Mon 10 Nov · Give more time" (plan section 12.1): the day
 * suppliers' links stop taking prices, and moving it, in place.
 */
function ReplyByLine({
  request,
  canAct,
  editing,
  onEdit,
  onSaved,
}: {
  request: PriceRequest
  canAct: boolean
  editing: boolean
  onEdit: (editing: boolean) => void
  onSaved: (next: PriceRequest) => void
}) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' })
  const [day, setDay] = useState(request.replyBy && request.replyBy >= today ? request.replyBy : today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const said = shortDate(request.replyBy ?? today)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      onSaved(await priceRequestsApi.giveMoreTime(request.id, day))
    } catch (err: unknown) {
      setError(isAppError(err) ? err.message : text.failed)
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <div className="mt-2 flex flex-wrap items-end gap-2" data-reply-by-editor>
        <label className="flex flex-col gap-1 text-sm text-neutral-800">
          {text.newDay}
          <input
            type="date"
            value={day}
            min={today}
            onChange={(event) => setDay(event.target.value)}
            className="min-h-11 rounded-md border border-neutral-300 bg-white px-3 text-base text-neutral-900 sm:text-sm"
          />
        </label>
        <Button variant="secondary" loading={busy} disabled={!day || day < today} onClick={() => void save()}>
          {text.saveDay}
        </Button>
        <Button variant="quiet" onClick={() => onEdit(false)}>
          {text.cancel}
        </Button>
        {error && <p className="w-full text-sm text-danger-700">{error}</p>}
      </div>
    )
  }
  return (
    <p className={`mt-0.5 text-sm ${request.repliesClosed ? 'text-warning-800' : 'text-neutral-600'}`} data-reply-by>
      {request.repliesClosed ? text.repliesClosed(said) : text.repliesClose(said)}
      {canAct && (
        <>
          {' · '}
          <button type="button" onClick={() => onEdit(true)} className="font-medium text-primary-700 hover:underline">
            {request.repliesClosed ? text.moreTime : text.changeDay}
          </button>
        </>
      )}
    </p>
  )
}

/**
 * Choosing (plan section 12.2; owner, 2026-11-06: "they can pick the supplier, but price is the default"): one block
 * per item, its suppliers' prices as the choice - starting on the lowest - and "Not now". Quick picks set every item
 * at once. Delivery days and their notes sit below, so quality or speed can win.
 */
function Choose({
  request,
  pickOf,
  onPick,
  onPickAll,
}: {
  request: PriceRequest
  pickOf: (lineId: string) => string | null
  onPick: (lineId: string, supplierId: string | null) => void
  onPickAll: (picks: Record<string, string | null>) => void
}) {
  const replied = request.suppliers.filter((supplier) => supplier.status === 'REPLIED')
  const others = request.suppliers.filter((supplier) => supplier.status !== 'REPLIED')
  const priced = (supplier: PriceRequestSupplier, lineId: string) =>
    supplier.quotes.find((quote) => quote.lineId === lineId)?.price != null
  return (
    <section aria-labelledby="rfq-choose" className="flex flex-col gap-2" data-choose>
      <div>
        <h2 id="rfq-choose" className="text-sm font-semibold text-neutral-900">
          {text.choose}
        </h2>
        <p className="text-xs text-neutral-600">{text.chooseHint}</p>
      </div>
      {replied.length > 1 && (
        <div className="flex flex-wrap gap-x-4 text-sm" data-quick-picks>
          <button type="button" onClick={() => onPickAll({})} className={linkClass}>
            {text.cheapestAll}
          </button>
          {replied.map((supplier) => (
            <button
              key={supplier.id}
              type="button"
              onClick={() =>
                onPickAll(
                  Object.fromEntries(
                    request.lines.map((line) => [line.id, priced(supplier, line.id) ? supplier.id : pickOf(line.id)]),
                  ),
                )
              }
              className={linkClass}
            >
              {text.allFrom(supplier.vendorName)}
            </button>
          ))}
        </div>
      )}
      <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
        {request.lines.map((line) => {
          const rows = replied
            .filter((supplier) => priced(supplier, line.id))
            .map((supplier) => ({ supplier, quote: supplier.quotes.find((quote) => quote.lineId === line.id)! }))
            .sort((a, b) => (a.quote.price ?? 0) - (b.quote.price ?? 0))
          const lowestAmount = rows[0]?.quote.amount ?? 0
          const chosen = pickOf(line.id)
          const name = `pick-${line.id}`
          return (
            <fieldset key={line.id} className="flex flex-col gap-0.5 px-4 py-3" data-choose-line={line.productName}>
              <legend className="contents">
                <span className="block pb-1 text-sm font-semibold text-neutral-900">
                  {line.productName}{' '}
                  <span className="text-xs font-normal text-neutral-600">· {quantityWords(line.quantity, line.comesIn).replace(/ \(.*\)$/, '')}</span>
                </span>
              </legend>
              {rows.map(({ supplier, quote }) => {
                const on = chosen === supplier.id
                const lowest = supplier.id === request.lowestByLine[line.id]
                const extra = (quote.amount ?? 0) - lowestAmount
                return (
                  <label
                    key={supplier.id}
                    className={`-mx-2 flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm tabular-nums ${on ? 'bg-primary-50' : 'hover:bg-neutral-50'}`}
                  >
                    <input type="radio" name={name} checked={on} onChange={() => onPick(line.id, supplier.id)} className="h-4 w-4 shrink-0 accent-primary-700" />
                    <span className={`min-w-0 flex-1 ${on ? 'font-semibold text-neutral-900' : 'text-neutral-800'}`}>
                      {supplier.vendorName}
                      {lowest && <span className="ml-1.5 rounded-full bg-accent-50 px-1.5 py-0.5 text-[11px] font-bold text-accent-700">{text.lowest}</span>}
                    </span>
                    <span className="shrink-0 text-right text-neutral-800">
                      {orderMoney(quote.price ?? 0)} · {orderMoney(quote.amount ?? 0)}
                      {extra > 0 && <span className="ml-1.5 text-xs text-neutral-500">{text.more(orderMoney(extra))}</span>}
                    </span>
                  </label>
                )
              })}
              <label className={`-mx-2 flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm ${chosen == null ? 'bg-neutral-100' : 'hover:bg-neutral-50'}`}>
                <input type="radio" name={name} checked={chosen == null} onChange={() => onPick(line.id, null)} className="h-4 w-4 shrink-0 accent-primary-700" />
                <span className="text-neutral-700">{text.notNow}</span>
              </label>
              {others.map((supplier) => (
                <p key={supplier.id} className="flex justify-between gap-3 pl-7 text-sm text-neutral-500">
                  <span>{supplier.vendorName}</span>
                  <span>{supplier.status === 'DECLINED' ? text.declined : text.noReply}</span>
                </p>
              ))}
              {replied
                .filter((supplier) => !priced(supplier, line.id))
                .map((supplier) => (
                  <p key={supplier.id} className="flex justify-between gap-3 pl-7 text-sm text-neutral-500">
                    <span>{supplier.vendorName}</span>
                    <span>{text.cantSupply}</span>
                  </p>
                ))}
            </fieldset>
          )
        })}
        <DeliveryAndNotes request={request} />
      </div>
    </section>
  )
}

/** One block per item, each supplier's price with the lowest marked; delivery with its day; their notes (mockup 1I). */
function Compare({ request }: { request: PriceRequest }) {
  const replied = request.suppliers.filter((supplier) => supplier.status === 'REPLIED')
  const others = request.suppliers.filter((supplier) => supplier.status !== 'REPLIED')
  return (
    <section aria-labelledby="rfq-compare" className="flex flex-col gap-2">
      <h2 id="rfq-compare" className="text-sm font-semibold text-neutral-900">
        {text.compare}
      </h2>
      <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
        {request.lines.map((line) => (
          <CompareLine
            key={line.id}
            line={line}
            replied={replied}
            others={others}
            lowest={request.lowestByLine[line.id]}
            picked={request.picked?.find((item) => item.lineId === line.id)}
          />
        ))}
        <DeliveryAndNotes request={request} />
      </div>
    </section>
  )
}

/** Each supplier's delivery charge and day (amber after Needed by), and their notes in their words (mockup 1I). */
function DeliveryAndNotes({ request }: { request: PriceRequest }) {
  const replied = request.suppliers.filter((supplier) => supplier.status === 'REPLIED')
  const noted = replied.filter((supplier) => supplier.remark)
  return (
    <>
        <div className="flex flex-col gap-1 px-4 py-3">
          <p className="text-sm font-semibold text-neutral-900">{text.delivery}</p>
          {replied.map((supplier) => {
            const late = request.neededBy != null && supplier.canDeliverOn != null && supplier.canDeliverOn > request.neededBy
            const day = supplier.canDeliverOn ? shortDate(supplier.canDeliverOn) : null
            return (
              <p key={supplier.id} className={`flex justify-between gap-3 text-sm tabular-nums ${late ? 'text-warning-800' : 'text-neutral-800'}`}>
                <span>{supplier.vendorName}</span>
                <span>
                  {supplier.deliveryCharge == null ? text.notSaid : supplier.deliveryCharge === 0 ? text.free : orderMoney(supplier.deliveryCharge)}
                  {day ? ` · ${late ? text.late(day) : text.byDay(day)}` : ''}
                </span>
              </p>
            )
          })}
        </div>
        {noted.length > 0 && (
          <div className="flex flex-col gap-1 px-4 py-3">
            <p className="text-sm font-semibold text-neutral-900">{text.notes}</p>
            {noted.map((supplier) => (
              <p key={supplier.id} className="text-sm text-neutral-800">
                {supplier.vendorName}: “{supplier.remark}”
              </p>
            ))}
          </div>
        )}
    </>
  )
}

function CompareLine({
  line,
  replied,
  others,
  lowest,
  picked,
}: {
  line: PriceRequestLine
  replied: PriceRequestSupplier[]
  others: PriceRequestSupplier[]
  lowest?: string
  /** Once it became orders: who this item went to (plan section 12.2). */
  picked?: PickedItem
}) {
  const rows = replied
    .map((supplier) => ({ supplier, quote: supplier.quotes.find((quote) => quote.lineId === line.id) }))
    .sort((a, b) => (a.quote?.price ?? Number.MAX_VALUE) - (b.quote?.price ?? Number.MAX_VALUE))
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <p className="text-sm font-semibold text-neutral-900">
        {line.productName} <span className="text-xs font-normal text-neutral-600">· {quantityWords(line.quantity, line.comesIn).replace(/ \(.*\)$/, '')}</span>
      </p>
      {rows.map(({ supplier, quote }) => {
        const best = supplier.id === lowest
        return (
          <p key={supplier.id} className={`flex justify-between gap-3 text-sm tabular-nums ${best ? 'font-semibold text-accent-700' : 'text-neutral-800'}`}>
            <span>
              {supplier.vendorName}
              {best && <span className="ml-1.5 rounded-full bg-accent-50 px-1.5 py-0.5 text-[11px] font-bold">{text.lowest}</span>}
              {picked?.supplierId === supplier.id && (
                <span className="ml-1.5 rounded-full bg-primary-50 px-1.5 py-0.5 text-[11px] font-bold text-primary-700">{text.ordered}</span>
              )}
            </span>
            <span>{quote?.price != null ? `${orderMoney(quote.price)} · ${orderMoney(quote.amount ?? 0)}` : text.cantSupply}</span>
          </p>
        )
      })}
      {others.map((supplier) => (
        <p key={supplier.id} className="flex justify-between gap-3 text-sm text-neutral-500">
          <span>{supplier.vendorName}</span>
          <span>{supplier.status === 'DECLINED' ? text.declined : text.noReply}</span>
        </p>
      ))}
      {/* A dearer pick, said once, so it can be explained later (plan section 12.2). */}
      {picked && picked.lowestPrice != null && picked.price > picked.lowestPrice && picked.lowestVendorName && (
        <p className="text-xs text-neutral-600" data-dearer-pick>
          {text.dearer(picked.vendorName, orderMoney(picked.price), orderMoney(picked.lowestPrice), picked.lowestVendorName)}
        </p>
      )}
    </div>
  )
}

/** "Add Tony's prices" (mockup 1J): what a supplier said on the phone, typed in place; boxes start at last time's prices left blank. */
function TypedReply({
  request,
  supplier,
  onSaved,
  onCancel,
}: {
  request: PriceRequest
  supplier: PriceRequestSupplier
  onSaved: (next: PriceRequest) => void
  onCancel: () => void
}) {
  const start = (lineId: string) => supplier.quotes.find((quote) => quote.lineId === lineId)
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(request.lines.map((line) => [line.id, start(line.id)?.price != null ? String(start(line.id)?.price) : ''])),
  )
  const [cannot, setCannot] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(request.lines.map((line) => [line.id, start(line.id)?.cannotSupply === true])),
  )
  const [delivery, setDelivery] = useState(supplier.deliveryCharge != null ? String(supplier.deliveryCharge) : '')
  const [remark, setRemark] = useState(supplier.remark ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = supplier.vendorName.split(' ')[0]

  const money = (typed: string) => {
    const cleaned = typed.replace(/[,\s₦]/g, '')
    if (cleaned === '') return null
    const value = Number(cleaned)
    return Number.isFinite(value) && value >= 0 ? value : null
  }

  async function save(declined: boolean) {
    setBusy(true)
    setError(null)
    try {
      onSaved(
        await priceRequestsApi.reply(request.id, supplier.id, {
          lines: request.lines.map((line) => ({ lineId: line.id, price: cannot[line.id] ? null : money(prices[line.id] ?? ''), cannotSupply: cannot[line.id] === true })),
          deliveryCharge: money(delivery),
          remark: remark.trim() || null,
          declined,
        }),
      )
    } catch (err: unknown) {
      setError(isAppError(err) ? err.message : text.failed)
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-neutral-900">
        {text.pricesOf(supplier.vendorName)} <span className="text-xs font-normal text-neutral-500">· {text.typedTag}</span>
      </p>
      <ul className="flex flex-col gap-2">
        {request.lines.map((line) => {
          const id = `typed-${supplier.id}-${line.id}`
          const shape = { comesIn: line.comesIn, pack: /·/.test(line.comesIn) && !/^loose/i.test(line.comesIn) }
          return (
            <li key={line.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor={id} className="min-w-0 text-sm text-neutral-800">
                  {line.productName}{' '}
                  <span className="text-xs text-neutral-500">· {quantityWords(line.quantity, line.comesIn).replace(/ \(.*\)$/, '')}</span>
                </label>
                {!cannot[line.id] && (
                  <span className="flex items-center rounded-md border border-neutral-200 bg-white focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100">
                    <span className="pl-2.5 text-neutral-500" aria-hidden="true">
                      ₦
                    </span>
                    <input
                      id={id}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={prices[line.id] ?? ''}
                      onChange={(event) => setPrices((current) => ({ ...current, [line.id]: event.target.value }))}
                      className="w-20 bg-transparent py-1.5 pl-1 text-right text-base font-semibold tabular-nums focus:outline-none sm:text-sm"
                    />
                    {/* The unit on the box, as on the supplier's own page: the price of ONE. */}
                    <span className="pr-2.5 pl-1 text-xs whitespace-nowrap text-neutral-600" aria-hidden="true">
                      {text.per(quantityUnitWord(shape, 1))}
                    </span>
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setCannot((current) => ({ ...current, [line.id]: !current[line.id] }))}
                className="self-end text-xs font-medium text-primary-700 hover:underline"
              >
                {cannot[line.id] ? text.canSupplyToggle : text.cantSupplyToggle}
              </button>
            </li>
          )
        })}
        <li className="flex items-center justify-between gap-3">
          <label htmlFor={`typed-${supplier.id}-delivery`} className="text-sm text-neutral-800">
            {text.deliveryTo}
          </label>
          <span className="flex items-center rounded-md border border-neutral-200 bg-white">
            <span className="pl-2.5 text-neutral-500" aria-hidden="true">
              ₦
            </span>
            <input
              id={`typed-${supplier.id}-delivery`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={delivery}
              onChange={(event) => setDelivery(event.target.value)}
              className="w-24 bg-transparent py-1.5 pr-2.5 pl-1 text-right text-base font-semibold tabular-nums focus:outline-none sm:text-sm"
            />
          </span>
        </li>
      </ul>
      <div className="flex flex-col gap-1">
        <label htmlFor={`typed-${supplier.id}-note`} className="text-xs font-medium text-neutral-700">
          {text.theirNote}
        </label>
        <input
          id={`typed-${supplier.id}-note`}
          type="text"
          maxLength={500}
          value={remark}
          onChange={(event) => setRemark(event.target.value)}
          className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-base sm:text-sm"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="action" loading={busy} onClick={() => void save(false)}>
          {text.save(name)}
        </Button>
        <Button variant="quiet" disabled={busy} onClick={() => void save(true)}>
          {text.cantDoIt(name)}
        </Button>
        <Button variant="quiet" disabled={busy} onClick={onCancel}>
          {text.cancel}
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-danger-700">{error}</p>}
    </div>
  )
}

const linkClass =
  'rounded-sm font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none'
