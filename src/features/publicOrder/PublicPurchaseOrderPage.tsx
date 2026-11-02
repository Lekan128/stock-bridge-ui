import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '@/api/client'
import { Button } from '@/components/Button'
import { Logo } from '@/components/Logo'
import { Skeleton } from '@/components/Skeleton'
import { shortDate } from '@/features/expected/expected'
import { isAppError } from '@/types/api'

/** What the API sends for `GET /api/public/purchase-orders/{token}` — only what is on the PDF. */
interface PublicPurchaseOrder {
  poNumber: string
  revision: number
  calledOff: boolean
  issuedOn?: string | null
  neededBy?: string | null
  note?: string | null
  buyer: { name: string; phone?: string | null; address?: string | null; logoUrl?: string | null }
  deliverTo?: { name?: string | null; address?: string | null; phone?: string | null } | null
  lines: { productName: string; comesIn: string; quantity: number }[]
  pdfPath: string
}

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; order: PublicPurchaseOrder }
  | { kind: 'missing' }
  | { kind: 'problem'; message: string }

const words = {
  heading: (buyer: string) => `${buyer} would like to order from you`,
  headingRevised: (buyer: string) => `${buyer} has changed this order`,
  number: (poNumber: string) => `Purchase order ${poNumber}`,
  revised: (revision: number) => `Revised (${revision})`,
  items: 'What they want',
  deliverTo: 'Deliver to',
  needed: 'Needed by',
  neededNone: 'As soon as you can',
  note: 'Note',
  ask: 'Please reply to them with your price, and when they can expect delivery.',
  pdf: 'View / print PDF',
  questions: (phone: string) => `Questions? Call ${phone}`,
  calledOffTitle: (buyer: string) => `${buyer} called this order off`,
  calledOffBody: 'There is nothing you need to do.',
  missingTitle: "We can't find this order",
  missingBody: 'Check the link you were sent, or ask the person who sent it to send it again.',
  problemTitle: "We couldn't open this order",
  tryAgain: 'Try again',
  footer: 'Sent through Procure Paddy',
}

/**
 * What a supplier sees when they open the link in an email or WhatsApp message
 * (`PURCHASE_ORDER_PLAN.md` §3.5). No account, no login, no sign-up pitch, and no prices — it says
 * what is wanted, where and when, and asks for a price back. Read on a phone, inside WhatsApp, so it
 * is one column that needs no zooming and one button.
 *
 * Not part of the workspace: it has its own plain surface (Inter, like the storefront and sign-in),
 * and it is kept out of search engines because the link is a secret.
 */
export function PublicPurchaseOrderPage() {
  const { token = '' } = useParams()
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    api
      .get<PublicPurchaseOrder>(`/api/public/purchase-orders/${encodeURIComponent(token)}`, { public: true })
      .then((response) => {
        if (!cancelled) setState({ kind: 'ready', order: response.data })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (isAppError(err) && (err.status === 404 || err.status === 400)) setState({ kind: 'missing' })
        else setState({ kind: 'problem', message: isAppError(err) ? err.message : words.problemTitle })
      })
    return () => {
      cancelled = true
    }
  }, [token, attempt])

  // The link is a secret: keep it out of search results, and give the tab a name that says what it is.
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => {
      meta.remove()
    }
  }, [])
  useEffect(() => {
    if (state.kind !== 'ready') return
    const previous = document.title
    document.title = `${words.number(state.order.poNumber)} from ${state.order.buyer.name}`
    return () => {
      document.title = previous
    }
  }, [state])

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 font-sans text-neutral-900">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
        {state.kind === 'loading' && (
          <div role="status" aria-busy="true" aria-label="Loading" className="flex flex-col gap-3">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}

        {state.kind === 'missing' && (
          <>
            <h1 className="text-xl font-semibold">{words.missingTitle}</h1>
            <p className="text-sm text-neutral-700">{words.missingBody}</p>
          </>
        )}

        {state.kind === 'problem' && (
          <>
            <h1 className="text-xl font-semibold">{words.problemTitle}</h1>
            <p className="text-sm text-neutral-700">{state.message}</p>
            <div>
              <Button variant="secondary" onClick={() => setAttempt((count) => count + 1)}>
                {words.tryAgain}
              </Button>
            </div>
          </>
        )}

        {state.kind === 'ready' && <Order order={state.order} />}

        <p className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
          <Logo variant="icon" size={16} />
          {words.footer}
        </p>
      </div>
    </main>
  )
}

function Order({ order }: { order: PublicPurchaseOrder }) {
  const base = String(api.defaults.baseURL ?? '').replace(/\/$/, '')
  const pdfUrl = `${base}${order.pdfPath}`
  const { buyer, deliverTo } = order

  if (order.calledOff) {
    return (
      <>
        <h1 className="text-xl font-semibold">{words.calledOffTitle(buyer.name)}</h1>
        <p className="text-sm text-neutral-700">
          {words.number(order.poNumber)}. {words.calledOffBody}
        </p>
      </>
    )
  }

  return (
    <>
      <header className="flex flex-col gap-2">
        {buyer.logoUrl && <img src={buyer.logoUrl} alt={buyer.name} className="h-14 w-auto max-w-40 self-start object-contain" />}
        <h1 className="text-xl font-semibold">
          {order.revision > 1 ? words.headingRevised(buyer.name) : words.heading(buyer.name)}
        </h1>
        <p className="text-sm text-neutral-600">
          {words.number(order.poNumber)}
          {order.issuedOn ? ` · ${shortDate(order.issuedOn)}` : ''}
          {order.revision > 1 ? ` · ${words.revised(order.revision)}` : ''}
        </p>
      </header>

      <section aria-labelledby="po-items" className="flex flex-col gap-1">
        <h2 id="po-items" className="text-sm font-semibold">
          {words.items}
        </h2>
        <ul className="divide-y divide-neutral-200 border-y border-neutral-200 bg-white">
          {order.lines.map((line, index) => (
            <li key={`${line.productName}-${index}`} className="flex items-baseline justify-between gap-3 px-1 py-3 text-sm">
              <span className="min-w-0 font-medium">{line.productName}</span>
              <span className="shrink-0 tabular-nums text-neutral-700">
                {line.quantity} × {line.comesIn}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="text-neutral-500">{words.needed}</dt>
        <dd>{order.neededBy ? shortDate(order.neededBy) : words.neededNone}</dd>
        {deliverTo?.name && (
          <>
            <dt className="text-neutral-500">{words.deliverTo}</dt>
            <dd>
              {deliverTo.name}
              {deliverTo.address ? `, ${deliverTo.address}` : ''}
            </dd>
          </>
        )}
        {order.note && (
          <>
            <dt className="text-neutral-500">{words.note}</dt>
            <dd className="whitespace-pre-line">{order.note}</dd>
          </>
        )}
      </dl>

      <p className="text-sm text-neutral-800">{words.ask}</p>

      <div className="flex flex-col gap-3">
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {words.pdf}
        </a>
        {buyer.phone && (
          <p className="text-sm text-neutral-700">
            <a
              href={`tel:${buyer.phone.replace(/\s+/g, '')}`}
              className="font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
              {words.questions(buyer.phone)}
            </a>
          </p>
        )}
      </div>
    </>
  )
}
