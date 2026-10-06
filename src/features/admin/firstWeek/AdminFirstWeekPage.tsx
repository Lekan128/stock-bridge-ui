import { CalendarCheck, Check, MessageCircle, Undo2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Pagination } from '@/components/Pagination'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/components/useToast'
import {
  firstWeekApi,
  type FirstWeekReport,
  type FirstWeekShop,
  type MessageKind,
} from '@/features/admin/firstWeek/firstWeekApi'
import { MESSAGES, ageInDays, messageState, messageText, nextDue } from '@/features/admin/firstWeek/firstWeekMessages'
import { formatWait } from '@/features/admin/setupRequests/setupRequestsApi'
import { formatDateTime } from '@/features/marketplace/formatters'
import { isAppError } from '@/types/api'
import { formatWhatsApp, whatsAppLink } from '@/utils/whatsappNumber'

const WINDOWS = [14, 30, 60]
const HOUR = 60 * 60 * 1000

function percent(part: number, whole: number): string {
  return whole === 0 ? '–' : `${Math.round((part / whole) * 100)}%`
}

/**
 * The first week — route `/admin/first-week` (LANDING_PAGE_PLAN.md, step 5).
 *
 * Every shop that signed up recently: how far it has got against the north star (activated:
 * products loaded and its own first stock change within 72 hours), and the one WhatsApp message
 * due now, written with its real numbers. Above it, the funnel the plan measures, from setup
 * request to habit, so the weakest step is obvious.
 */
export function AdminFirstWeekPage() {
  const { showToast } = useToast()
  const [days, setDays] = useState(30)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [report, setReport] = useState<FirstWeekReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    firstWeekApi
      .report({ days, page, search: query })
      .then((next) => {
        setReport(next)
        setNow(Date.now())
      })
      .catch((err: unknown) => setError(isAppError(err) ? err.message : 'We could not load the first week.'))
      .finally(() => setLoading(false))
  }, [days, page, query])

  useEffect(() => {
    load()
  }, [load])

  // Search as the team types, without a request per key.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim())
      setPage(0)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search])

  async function mark(shop: FirstWeekShop, kind: MessageKind, sent: boolean) {
    try {
      if (sent) await firstWeekApi.markSent(shop.clientId, kind)
      else await firstWeekApi.unmark(shop.clientId, kind)
      load()
    } catch (err: unknown) {
      showToast(isAppError(err) ? err.message : 'We could not save that.', 'error')
    }
  }

  const due = report?.shops.filter((shop) => nextDue(shop, now) != null).length ?? 0

  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-neutral-900">
            <CalendarCheck className="h-5 w-5 text-primary-600" aria-hidden="true" />
            First week
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            Every shop that signed up recently. The aim: its products loaded and its own first stock change within 72
            hours. Send the message that&apos;s due on WhatsApp; it is written with the shop&apos;s own numbers.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <span className="sr-only">Find a shop</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find a shop or Company ID"
              className="min-h-10 w-56 rounded-md border border-neutral-200 bg-white px-3 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            Signed up in the last
            <select
              value={days}
              onChange={(event) => {
                setDays(Number(event.target.value))
                setPage(0)
              }}
              className="min-h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm"
            >
              {WINDOWS.map((window) => (
                <option key={window} value={window}>
                  {window} days
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {report && (
        <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            {
              label: 'Setup requests',
              value: report.setupRequests,
              note: 'from the website',
            },
            {
              label: 'Accounts',
              value: report.signups,
              note: percent(report.signups, report.setupRequests) + ' of requests',
            },
            {
              label: 'Products loaded',
              value: report.productsLoaded,
              note: percent(report.productsLoaded, report.signups) + ' of accounts',
            },
            {
              label: 'Activated',
              value: report.activated,
              note: percent(report.activated, report.signups) + ' within 72 h',
            },
            {
              label: 'Habit',
              value: report.habit,
              note: `${percent(report.habit, report.habitEligible)} of ${report.habitEligible} a week old`,
            },
          ].map((step) => (
            <div key={step.label} className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
              <dt className="text-xs font-medium text-neutral-600">{step.label}</dt>
              <dd className="text-2xl font-bold text-neutral-900 tabular-nums">{step.value}</dd>
              <dd className="text-xs text-neutral-600">{step.note}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-5">
        {error && (
          <ErrorState variant="block" title="We could not load the first week" message={error} onRetry={load} />
        )}
        {loading && !report && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-40 w-full rounded-lg" />
            ))}
          </div>
        )}
        {report && report.shops.length === 0 && (
          <EmptyState
            icon={CalendarCheck}
            title={query ? 'No shop matches' : 'No new shops'}
            description={
              query
                ? `Nothing in the last ${report.days} days matches “${query}”.`
                : `Nobody signed up in the last ${report.days} days.`
            }
          />
        )}
        {report && report.shops.length > 0 && (
          <>
            <p className="mb-3 text-sm text-neutral-700">
              On this page, <span className="font-semibold text-neutral-900">{due}</span>{' '}
              {due === 1 ? 'shop has' : 'shops have'} a message due.
            </p>
            <ul className={`space-y-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
              {report.shops.map((shop) => (
                <ShopRow
                  key={shop.clientId}
                  shop={shop}
                  now={now}
                  onMark={(kind, sent) => void mark(shop, kind, sent)}
                />
              ))}
            </ul>
            <Pagination page={page} totalPages={report.totalPages} onPageChange={setPage} className="mt-6" />
          </>
        )}
      </div>
    </div>
  )
}

function ShopRow({
  shop,
  now,
  onMark,
}: {
  shop: FirstWeekShop
  now: number
  onMark: (kind: MessageKind, sent: boolean) => void
}) {
  const a = shop.activity
  const age = ageInDays(shop, now)
  const due = nextDue(shop, now)
  const hoursLeft = 72 - (now - new Date(shop.createdAt).getTime()) / HOUR
  const firstChangeAfter = a.firstStockChangeAt
    ? (new Date(a.firstStockChangeAt).getTime() - new Date(shop.createdAt).getTime()) / 60_000
    : null

  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-neutral-900">{shop.name}</h2>
            {shop.founding && <Badge variant="info">Founding</Badge>}
            {shop.activated ? (
              <Badge variant="success">Activated</Badge>
            ) : hoursLeft > 0 ? (
              <Badge variant="warning">{Math.ceil(hoursLeft)} h left to activate</Badge>
            ) : (
              <Badge variant="danger">Not activated</Badge>
            )}
            {shop.habit && <Badge variant="success">Habit</Badge>}
          </div>
          <p className="mt-1 text-sm text-neutral-700">
            <span className="font-mono">{shop.companyId}</span>
            {' · '}
            {shop.whatsapp ? formatWhatsApp(shop.whatsapp) : 'No WhatsApp number'}
            {' · '}signed up {age < 1 ? 'today' : `${Math.floor(age)} ${Math.floor(age) === 1 ? 'day' : 'days'} ago`}
          </p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-5">
        <Fact
          label="Products"
          value={a.products > 0 ? String(a.products) : a.listFiles > 0 ? 'List sent' : 'None yet'}
          done={a.products > 0}
        />
        <Fact
          label="First stock change"
          value={firstChangeAfter != null ? `after ${formatWait(firstChangeAfter)}` : 'Not yet'}
          done={firstChangeAfter != null}
        />
        <Fact label="Days active, first week" value={`${a.activeDaysFirstWeek} of 7`} done={shop.habit} />
        <Fact label="Staff" value={String(a.staff)} done={a.staff > 0} />
        <Fact
          label="Support access"
          value={shop.supportAccess === 'ON' ? 'On' : shop.supportAccess === 'OFF' ? 'Switched off' : 'Not used'}
        />
      </dl>

      <div className="mt-4 flex flex-col gap-3 border-t border-neutral-100 pt-3 lg:flex-row lg:items-start lg:justify-between">
        <ol className="flex flex-wrap gap-2" aria-label="First-week messages">
          {MESSAGES.map((message) => {
            const state = messageState(shop, message.kind, now)
            const sentAt = shop.messages[message.kind]
            return (
              <li
                key={message.kind}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${
                  state === 'sent'
                    ? 'border-accent-200 bg-accent-50 text-accent-900'
                    : state === 'due'
                      ? 'border-warning-200 bg-warning-50 text-warning-900'
                      : 'border-neutral-200 text-neutral-600'
                }`}
              >
                {state === 'sent' && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                <span className="font-medium">{message.label}</span>
                <span>
                  {state === 'sent' && sentAt
                    ? formatDateTime(sentAt)
                    : state === 'due'
                      ? 'due'
                      : state === 'skip'
                        ? 'not needed'
                        : 'later'}
                </span>
                {state === 'sent' && (
                  <button
                    type="button"
                    onClick={() => onMark(message.kind, false)}
                    className="rounded p-0.5 hover:bg-accent-100"
                    aria-label={`Undo: ${message.label} not sent`}
                  >
                    <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </li>
            )
          })}
        </ol>

        {due && shop.whatsapp && (
          <div className="flex flex-col gap-2 lg:w-96">
            <p className="rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-800">{messageText(shop, due)}</p>
            <div className="flex flex-wrap gap-2">
              <a
                href={whatsAppLink(shop.whatsapp, messageText(shop, due))}
                target="_blank"
                rel="noreferrer"
                onClick={() => onMark(due, true)}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-action px-4 text-sm font-semibold text-white hover:bg-action-hover"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Send on WhatsApp
              </a>
              <button
                type="button"
                onClick={() => onMark(due, true)}
                className="min-h-10 rounded-md px-3 text-sm font-medium text-primary-600 hover:underline"
              >
                Mark as sent
              </button>
            </div>
          </div>
        )}
        {due && !shop.whatsapp && (
          <p className="text-sm text-neutral-600">
            A message is due, but the shop gave no WhatsApp number. Reach it by email or phone, then mark it sent.
          </p>
        )}
      </div>
    </li>
  )
}

function Fact({ label, value, done }: { label: string; value: string; done?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-neutral-600">{label}</dt>
      <dd className={`flex items-center gap-1 font-medium ${done ? 'text-accent-800' : 'text-neutral-900'}`}>
        {done && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
        {value}
      </dd>
    </div>
  )
}
