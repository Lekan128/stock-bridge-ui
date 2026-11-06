import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import { Button } from '@/components/Button'
import { Logo } from '@/components/Logo'
import { Skeleton } from '@/components/Skeleton'
import { priceRequestsApi, type PriceReplyInput, type PublicPriceRequest } from '@/features/expected/api/priceRequestsApi'
import { orderMoney, shortDate } from '@/features/expected/expected'
import { perUnitWords, quantityUnitWord } from '@/features/imports/delivery'
import { isAppError } from '@/types/api'

const words = {
  heading: (buyer: string) => `${buyer} asks for your prices`,
  meta: (rfq: string, replyBy: string | null, where: string | null, needed: string | null) =>
    [rfq, replyBy ? `reply by ${replyBy}` : null, [where ? `for ${where}` : null, needed ? `by ${needed}` : null].filter(Boolean).join(', ') || null]
      .filter(Boolean)
      .join(' · '),
  replyingAs: (supplier: string) => `Replying as ${supplier}`,
  your: (per: string) => `your price ${per}`,
  forAll: (amount: string, count: string) => `${amount} for ${count}`,
  dontHave: "I don't have this",
  haveIt: 'I have this after all',
  notSupplying: "You don't have this",
  delivery: (where: string | null) => (where ? `Delivery to ${where}` : 'Delivery'),
  deliveryHint: 'Leave it at 0 if delivery is free',
  when: 'When can you deliver?',
  byNeeded: (day: string) => `By ${day}`,
  asSoon: 'As soon as asked',
  anotherDay: 'Another day',
  anotherDayLabel: 'The day you can deliver',
  remark: (buyer: string) => `Anything to tell ${buyer}? (optional)`,
  remarkHint: 'How long the price holds, a different brand, only part of the amount…',
  send: (total: string | null) => (total ? `Send my prices · ${total}` : 'Send my prices'),
  sendNote: (buyer: string, day: string | null) =>
    day ? `${buyer} sees them straight away. You can change them until ${day}.` : `${buyer} sees them straight away. You can change them until they decide.`,
  repliesClosed: (day: string) => `Replies closed on ${day}`,
  closedWithReply: (buyer: string) => `Your prices are with ${buyer}. To change them, call ${buyer}.`,
  closedNoReply: (buyer: string) => `${buyer} isn't taking prices for this any more.`,
  sending: 'Sending…',
  none: 'Type a price for at least one item, or tap “I can’t do any of it”.',
  cantDoIt: "I can't do any of it",
  sent: (buyer: string, when: string) => `${buyer} has your prices · ${when}`,
  declinedSent: (buyer: string) => `You told ${buyer} you can't do it this time.`,
  change: 'Change my prices',
  total: 'Total',
  deliveryRow: 'Delivery',
  free: 'Free',
  canDeliver: (day: string) => `Can deliver ${day}`,
  questions: (buyer: string, phone: string) => `Questions? ${buyer}: ${phone}`,
  ordered: (buyer: string) => `${buyer} ordered from you`,
  seeOrder: 'See the order',
  closed: (buyer: string) => `${buyer} has decided`,
  closedBody: 'Thank you for your prices. This request is closed.',
  missingTitle: "This link isn't working",
  missingBody: 'Ask whoever sent it to send it again.',
  problem: "We couldn't load this just now. Check your connection and try again.",
  failed: "That didn't send. Check your connection and try again.",
  through: 'Sent through Procure Paddy',
}

interface Draft {
  prices: Record<string, string>
  cannot: Record<string, boolean>
  delivery: string
  when: 'NEEDED' | 'OTHER' | null
  day: string
  remark: string
}

const EMPTY: Draft = { prices: {}, cannot: {}, delivery: '', when: null, day: '', remark: '' }

function money(text: string): number | null {
  const cleaned = text.replace(/[,\s₦]/g, '')
  if (cleaned === '') return null
  const value = Number(cleaned)
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : null
}

function storageKey(token: string): string {
  return `price-reply:${token}`
}

function readDraft(token: string): Draft | null {
  try {
    const raw = localStorage.getItem(storageKey(token))
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Draft) } : null
  } catch {
    return null
  }
}

function writeDraft(token: string, draft: Draft | null) {
  try {
    if (draft) localStorage.setItem(storageKey(token), JSON.stringify(draft))
    else localStorage.removeItem(storageKey(token))
  } catch {
    // A phone that won't keep it just doesn't keep the draft.
  }
}

function fromReply(page: PublicPriceRequest): Draft {
  const reply = page.reply
  if (!reply) return EMPTY
  const prices: Record<string, string> = {}
  const cannot: Record<string, boolean> = {}
  for (const quote of reply.quotes) {
    if (quote.price != null) prices[quote.lineId] = new Intl.NumberFormat('en-NG').format(quote.price)
    if (quote.cannotSupply) cannot[quote.lineId] = true
  }
  return {
    prices,
    cannot,
    delivery: reply.deliveryCharge != null ? String(reply.deliveryCharge) : '',
    when: reply.canDeliverOn ? (reply.canDeliverOn === page.neededBy ? 'NEEDED' : 'OTHER') : null,
    day: reply.canDeliverOn ?? '',
    remark: reply.remark ?? '',
  }
}

type State = { kind: 'loading' } | { kind: 'ready'; page: PublicPriceRequest } | { kind: 'missing' } | { kind: 'problem' }

/**
 * The supplier's own page for a price request (PURCHASE_ORDER_PLAN.md section 11.3; mockups 1E/1F).
 * No account, any phone: the buyer's name, one price box per item with the unit spelled out ("your
 * price per bag"), "I don't have this", delivery, when they can deliver, and a remark. The total adds
 * up as they type. After sending they see what they sent and can change it until the buyer decides;
 * then the same link shows the outcome, never "you lost".
 */
export function PublicPriceRequestPage() {
  const { token = '' } = useParams()
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [editing, setEditing] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    priceRequestsApi
      .publicView(token)
      .then((page) => {
        if (cancelled) return
        setState({ kind: 'ready', page })
        setDraft(readDraft(token) ?? fromReply(page))
        setEditing(page.reply == null)
        // Counted only when this script runs on their phone, so a WhatsApp preview never says "opened".
        void priceRequestsApi.publicOpened(token).catch(() => undefined)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState(isAppError(err) && err.status === 404 ? { kind: 'missing' } : { kind: 'problem' })
      })
    return () => {
      cancelled = true
    }
  }, [token])

  function patch(next: Partial<Draft>) {
    setDraft((current) => {
      const merged = { ...current, ...next }
      writeDraft(token, merged)
      return merged
    })
  }

  const page = state.kind === 'ready' ? state.page : null
  // Takes prices: the buyer hasn't decided, and the Reply by day hasn't passed (plan section 12.1).
  const takes = page != null && page.state === 'OPEN' && !page.repliesClosed
  const total = useMemo(() => {
    if (!page) return null
    let sum = 0
    let any = false
    for (const line of page.lines) {
      if (draft.cannot[line.id]) continue
      const price = money(draft.prices[line.id] ?? '')
      if (price == null) continue
      sum += price * line.quantity
      any = true
    }
    if (!any) return null
    return Math.round((sum + (money(draft.delivery) ?? 0)) * 100) / 100
  }, [page, draft])

  async function send(declined = false) {
    if (!page) return
    setSending(true)
    setError(null)
    const body: PriceReplyInput = {
      lines: page.lines.map((line) => ({
        lineId: line.id,
        price: draft.cannot[line.id] ? null : money(draft.prices[line.id] ?? ''),
        cannotSupply: declined || draft.cannot[line.id] === true,
      })),
      deliveryCharge: money(draft.delivery),
      canDeliverOn: draft.when === 'NEEDED' ? (page.neededBy ?? null) : draft.when === 'OTHER' && draft.day ? draft.day : null,
      remark: draft.remark.trim() || null,
      declined,
    }
    try {
      const next = await priceRequestsApi.publicReply(token, body)
      writeDraft(token, null)
      setState({ kind: 'ready', page: next })
      setDraft(fromReply(next))
      setEditing(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: unknown) {
      setError(isAppError(err) ? err.message : words.failed)
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 pt-6 pb-36 font-sans text-neutral-900">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
        {state.kind === 'loading' && (
          <div role="status" aria-busy="true" aria-label="Loading" className="flex flex-col gap-3">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}
        {state.kind === 'missing' && (
          <section className="flex flex-col gap-2">
            <h1 className="text-xl font-semibold">{words.missingTitle}</h1>
            <p className="text-sm text-neutral-700">{words.missingBody}</p>
          </section>
        )}
        {state.kind === 'problem' && <p className="text-sm text-neutral-700">{words.problem}</p>}
        {page && (
          <>
            <header className="flex items-center gap-3">
              {page.buyerLogoUrl ? (
                <img src={page.buyerLogoUrl} alt="" className="h-10 w-auto max-w-24 object-contain" />
              ) : (
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary-900 text-sm font-bold text-white" aria-hidden="true">
                  {page.buyerName.slice(0, 2).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <h1 className="text-lg leading-tight font-semibold">{words.heading(page.buyerName)}</h1>
                <p className="text-xs text-neutral-600">
                  {words.meta(page.rfqNumber, page.replyBy ? shortDate(page.replyBy) : null, page.deliverTo ?? null, page.neededBy ? shortDate(page.neededBy) : null)}
                </p>
              </div>
            </header>

            {page.state === 'ORDERED' && (
              <section className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4">
                <p className="font-semibold">{words.ordered(page.buyerName)}</p>
                {page.orderNumber && <p className="text-sm text-neutral-600">{page.orderNumber}</p>}
                {page.orderUrl && (
                  <a href={page.orderUrl} className="inline-flex min-h-11 items-center justify-center rounded-md bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover">
                    {words.seeOrder}
                  </a>
                )}
              </section>
            )}
            {page.state === 'CLOSED' && (
              <section className="flex flex-col gap-1 rounded-lg border border-neutral-200 bg-white p-4">
                <p className="font-semibold">{words.closed(page.buyerName)}</p>
                <p className="text-sm text-neutral-600">{words.closedBody}</p>
              </section>
            )}

            {/* Past the Reply by day (plan section 12.1): what they sent, read-only, and who to call. */}
            {page.state === 'OPEN' && page.repliesClosed && (
              <section className="flex flex-col gap-1 rounded-lg border border-neutral-200 bg-white p-4" data-replies-closed>
                <p className="font-semibold">{words.repliesClosed(page.replyBy ? shortDate(page.replyBy) : '')}</p>
                <p className="text-sm text-neutral-600">
                  {page.reply ? words.closedWithReply(page.buyerName) : words.closedNoReply(page.buyerName)}
                  {page.buyerPhone ? ` ${page.buyerPhone}` : ''}
                </p>
              </section>
            )}

            {page.reply && !(takes && editing) && <Sent page={page} onChange={takes ? () => setEditing(true) : undefined} />}

            {takes && editing && (
              <>
                <p className="text-xs text-neutral-600">{words.replyingAs(page.supplierName)}</p>
                <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
                  {page.lines.map((line) => {
                    const id = `price-${line.id}`
                    const cannot = draft.cannot[line.id] === true
                    const price = money(draft.prices[line.id] ?? '')
                    const shape = { comesIn: line.comesIn, pack: /·/.test(line.comesIn) && !/^loose/i.test(line.comesIn) }
                    const count = `${new Intl.NumberFormat('en-NG').format(line.quantity)} ${quantityUnitWord(shape, line.quantity)}`
                    return (
                      <li key={line.id} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <label htmlFor={id} className="min-w-0">
                            <span className="block font-semibold">{line.productName}</span>
                            <span className="block text-xs text-neutral-600">
                              {count} · {cannot ? words.notSupplying : words.your(perUnitWords(shape))}
                            </span>
                          </label>
                          {!cannot && (
                            <span className="flex items-center rounded-md border border-neutral-300 bg-white focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100">
                              <span className="pl-2.5 text-neutral-500" aria-hidden="true">
                                ₦
                              </span>
                              <input
                                id={id}
                                type="text"
                                inputMode="decimal"
                                autoComplete="off"
                                value={draft.prices[line.id] ?? ''}
                                onChange={(event) => patch({ prices: { ...draft.prices, [line.id]: event.target.value } })}
                                className="w-28 bg-transparent py-2 pr-2.5 pl-1 text-right text-base font-semibold tabular-nums focus:outline-none"
                              />
                            </span>
                          )}
                        </div>
                        <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-neutral-600">
                          {!cannot && price != null && <span className="tabular-nums">{words.forAll(orderMoney(price * line.quantity), count)}</span>}
                          <button
                            type="button"
                            onClick={() => patch({ cannot: { ...draft.cannot, [line.id]: !cannot } })}
                            className="font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                          >
                            {cannot ? words.haveIt : words.dontHave}
                          </button>
                        </p>
                      </li>
                    )
                  })}
                  <li className="flex items-center justify-between gap-3 px-4 py-3">
                    <label htmlFor="price-delivery" className="min-w-0">
                      <span className="block font-semibold">{words.delivery(page.deliverTo ?? null)}</span>
                      <span className="block text-xs text-neutral-600">{words.deliveryHint}</span>
                    </label>
                    <span className="flex items-center rounded-md border border-neutral-300 bg-white focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100">
                      <span className="pl-2.5 text-neutral-500" aria-hidden="true">
                        ₦
                      </span>
                      <input
                        id="price-delivery"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="0"
                        value={draft.delivery}
                        onChange={(event) => patch({ delivery: event.target.value })}
                        className="w-28 bg-transparent py-2 pr-2.5 pl-1 text-right text-base font-semibold tabular-nums focus:outline-none"
                      />
                    </span>
                  </li>
                </ul>

                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-sm font-medium text-neutral-800">{words.when}</legend>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ['NEEDED', page.neededBy ? words.byNeeded(shortDate(page.neededBy)) : words.asSoon],
                      ['OTHER', words.anotherDay],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={draft.when === value}
                        onClick={() => patch({ when: draft.when === value ? null : (value as Draft['when']) })}
                        className={`rounded-full border px-3 py-1.5 text-sm ${
                          draft.when === value ? 'border-primary-100 bg-primary-100 font-semibold text-primary-900' : 'border-neutral-300 bg-white text-neutral-800'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {draft.when === 'OTHER' && (
                    <input
                      type="date"
                      aria-label={words.anotherDayLabel}
                      value={draft.day}
                      onChange={(event) => patch({ day: event.target.value })}
                      className="self-start rounded-md border border-neutral-300 bg-white px-3 py-2 text-base"
                    />
                  )}
                </fieldset>

                <div className="flex flex-col gap-1">
                  <label htmlFor="price-remark" className="text-sm font-medium text-neutral-800">
                    {words.remark(page.buyerName)}
                  </label>
                  <textarea
                    id="price-remark"
                    rows={3}
                    maxLength={500}
                    value={draft.remark}
                    placeholder={words.remarkHint}
                    onChange={(event) => patch({ remark: event.target.value })}
                    className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base placeholder:text-neutral-400"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void send(true)}
                  disabled={sending}
                  className="self-start text-sm font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                  {words.cantDoIt}
                </button>
              </>
            )}

            {page.buyerPhone && <p className="text-xs text-neutral-600">{words.questions(page.buyerName, page.buyerPhone)}</p>}
            <p className="flex items-center gap-2 text-xs text-neutral-500">
              <Logo variant="icon" size={16} />
              {words.through}
            </p>
          </>
        )}
      </div>

      {page && takes && editing && (
        <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto flex max-w-xl flex-col gap-1">
            <Button variant="action" className="w-full" loading={sending} disabled={total == null} onClick={() => void send(false)}>
              {sending ? words.sending : words.send(total != null ? orderMoney(total) : null)}
            </Button>
            <p className="text-center text-xs text-neutral-600">{error ?? (total == null ? words.none : words.sendNote(page.buyerName, page.replyBy ? shortDate(page.replyBy) : null))}</p>
          </div>
        </div>
      )}
    </main>
  )
}

function Sent({ page, onChange }: { page: PublicPriceRequest; onChange?: () => void }) {
  const reply = page.reply
  if (!reply) return null
  const when = new Intl.DateTimeFormat('en-NG', { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(reply.repliedAt))
  return (
    <section className="flex flex-col gap-3">
      <p className="flex items-start gap-2 rounded-md bg-accent-50 px-3 py-2.5 text-sm text-accent-800" role="status">
        <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {reply.declined ? words.declinedSent(page.buyerName) : words.sent(page.buyerName, when)}
      </p>
      {!reply.declined && (
        <div className="rounded-lg border border-neutral-200 bg-white text-sm">
          {page.lines.map((line) => {
            const quote = reply.quotes.find((entry) => entry.lineId === line.id)
            return (
              <div key={line.id} className="flex justify-between gap-3 px-4 py-2">
                <span className="text-neutral-700">
                  {line.productName}
                  {quote?.price != null ? ` · ${new Intl.NumberFormat('en-NG').format(line.quantity)} × ${orderMoney(quote.price)}` : ''}
                </span>
                <span className="tabular-nums">{quote?.amount != null ? orderMoney(quote.amount) : words.notSupplying}</span>
              </div>
            )
          })}
          {reply.deliveryCharge != null && (
            <div className="flex justify-between gap-3 px-4 py-2">
              <span className="text-neutral-700">{words.deliveryRow}</span>
              <span className="tabular-nums">{reply.deliveryCharge === 0 ? words.free : orderMoney(reply.deliveryCharge)}</span>
            </div>
          )}
          <div className="flex justify-between gap-3 border-t border-neutral-200 px-4 py-2.5 font-semibold">
            <span>{words.total}</span>
            <span className="tabular-nums">{reply.total != null ? orderMoney(reply.total) : '—'}</span>
          </div>
          {(reply.canDeliverOn || reply.remark) && (
            <p className="px-4 pb-3 text-xs text-neutral-600">
              {[reply.canDeliverOn ? words.canDeliver(shortDate(reply.canDeliverOn)) : null, reply.remark ? `“${reply.remark}”` : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
      )}
      {onChange && (
        <Button variant="secondary" className="self-start" onClick={onChange}>
          {words.change}
        </Button>
      )}
    </section>
  )
}
