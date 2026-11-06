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
  type PriceOption,
  type PriceRequest,
  type PriceRequestLine,
  type PriceRequestSupplier,
} from '@/features/expected/api/priceRequestsApi'
import { orderMoney, quantityWords, shortDate, whenText } from '@/features/expected/expected'
import { perUnitWords } from '@/features/imports/delivery'
import { isAppError } from '@/types/api'

const LIST_PATH = '/app/purchase-orders'

const text = {
  list: 'Purchase orders',
  asking: (rfq: string) => `${rfq} · Asking for prices`,
  replied: (rfq: string, done: number, all: number) => `${rfq} · ${done} of ${all} replied`,
  done: (rfq: string) => `${rfq} · Done`,
  closed: (rfq: string) => `${rfq} · Closed`,
  replyBy: (day: string) => `reply by ${day}`,
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
  orderFrom: 'Order from',
  cheapest: (total: string) => `Cheapest for each item · ${total}`,
  cheapestNote: (count: number, names: string) => `${count} orders: ${names}. Each delivery charge is included.`,
  everything: (name: string, total: string) => `Everything from ${name} · ${total}`,
  partly: (covered: number, all: number) => `Only ${covered} of ${all} items`,
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
  pricePer: (per: string) => `price ${per}`,
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
  const [choice, setChoice] = useState<string | null>(null)
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
  const options = request.options
  const selected = choice ?? (options[0] ? optionKey(options[0]) : null)
  const chosenOption = options.find((option) => optionKey(option) === selected) ?? null
  const waitingFor = request.suppliers.filter((supplier) => supplier.status !== 'REPLIED' && supplier.status !== 'DECLINED').map((s) => s.vendorName)

  async function make() {
    if (!chosenOption) return
    setBusy(true)
    setError(null)
    try {
      const made = await priceRequestsApi.choose(id, chosenOption.kind, chosenOption.supplierId ?? undefined)
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
          <p className="mt-1 text-sm text-neutral-600">
            {what}
            {request.replyBy && open ? ` · ${text.replyBy(shortDate(request.replyBy))}` : ''}
          </p>
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

        {open && (
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
                    {canAct && supplier.status !== 'REPLIED' && supplier.status !== 'DECLINED' && (
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
                    {supplier.remark && <span className="mt-1 block text-sm text-neutral-800">“{supplier.remark}”</span>}
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

        {replied.length > 0 && (
          <Compare request={request} />
        )}

        {open && canAct && options.length > 0 && (
          <section aria-labelledby="rfq-choose" className="flex flex-col gap-2">
            <h2 id="rfq-choose" className="text-sm font-semibold text-neutral-900">
              {text.orderFrom}
            </h2>
            <div className="divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200 bg-white">
              {options.map((option) => {
                const key = optionKey(option)
                const on = key === selected
                return (
                  <label key={key} className={`flex cursor-pointer items-start gap-3 px-4 py-3 ${on ? 'bg-primary-50' : ''}`}>
                    <input type="radio" name="rfq-option" checked={on} onChange={() => setChoice(key)} className="mt-0.5 h-4 w-4 accent-primary-700" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-neutral-900">
                        {option.kind === 'CHEAPEST' ? text.cheapest(orderMoney(option.total)) : text.everything(option.suppliers[0], orderMoney(option.total))}
                      </span>
                      {option.kind === 'CHEAPEST' && (
                        <span className="block text-xs text-neutral-600">{text.cheapestNote(option.orders, option.suppliers.join(', '))}</span>
                      )}
                      {option.linesCovered < request.lines.length && (
                        <span className="block text-xs text-warning-800">{text.partly(option.linesCovered, request.lines.length)}</span>
                      )}
                    </span>
                  </label>
                )
              })}
            </div>
            {waitingFor.length > 0 && <p className="text-xs text-neutral-600">{text.dontWait(waitingFor.join(', '))}</p>}
          </section>
        )}

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

      {open && canAct && chosenOption && (
        <div className="sticky -bottom-6 z-10 -mx-6 mt-6 -mb-6 border-t border-neutral-200 bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto flex max-w-2xl flex-col gap-1">
            <Button variant="action" className="w-full" loading={busy} onClick={() => void make()}>
              {text.make(chosenOption.orders)}
            </Button>
            <p className="text-center text-xs text-neutral-600">{text.makeNote}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function optionKey(option: PriceOption): string {
  return option.kind === 'CHEAPEST' ? 'CHEAPEST' : `SUPPLIER:${option.supplierId}`
}

/** One block per item, each supplier's price with the lowest marked; delivery with its day; their notes (mockup 1I). */
function Compare({ request }: { request: PriceRequest }) {
  const replied = request.suppliers.filter((supplier) => supplier.status === 'REPLIED')
  const others = request.suppliers.filter((supplier) => supplier.status !== 'REPLIED')
  const noted = replied.filter((supplier) => supplier.remark)
  return (
    <section aria-labelledby="rfq-compare" className="flex flex-col gap-2">
      <h2 id="rfq-compare" className="text-sm font-semibold text-neutral-900">
        {text.compare}
      </h2>
      <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
        {request.lines.map((line) => (
          <CompareLine key={line.id} line={line} replied={replied} others={others} lowest={request.lowestByLine[line.id]} />
        ))}
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
      </div>
    </section>
  )
}

function CompareLine({
  line,
  replied,
  others,
  lowest,
}: {
  line: PriceRequestLine
  replied: PriceRequestSupplier[]
  others: PriceRequestSupplier[]
  lowest?: string
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
                  <span className="text-xs text-neutral-500">
                    · {quantityWords(line.quantity, line.comesIn).replace(/ \(.*\)$/, '')} · {text.pricePer(perUnitWords(shape))}
                  </span>
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
                      className="w-24 bg-transparent py-1.5 pr-2.5 pl-1 text-right text-base font-semibold tabular-nums focus:outline-none sm:text-sm"
                    />
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
