import { Bell, BellOff, Copy, Download, FileText, Inbox, LogIn, MessageCircle, PhoneIncoming, Store } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Pagination } from '@/components/Pagination'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/components/useToast'
import {
  STATUS_LABELS,
  awaitingReply,
  formatWait,
  inStaffedHours,
  replyLink,
  setupRequestsApi,
  type ProductListFile,
  type SetupRequest,
  type SetupRequestStatus,
  type SetupRequestTab,
} from '@/features/admin/setupRequests/setupRequestsApi'
import { useSetupRequests } from '@/features/admin/setupRequests/useSetupRequests'
import { formatDateTime } from '@/features/marketplace/formatters'
import { isAppError } from '@/types/api'
import { formatWhatsApp } from '@/utils/whatsappNumber'

const PAGE_SIZE = 20
/** Plan rule 5: a reply within 5 minutes in staffed hours. */
const REPLY_DUE_MINUTES = 5

type Tab = SetupRequestTab | 'ALL'

const TABS: { key: Tab; label: string }[] = [
  { key: 'NEW', label: 'Waiting' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'RUNNING', label: 'Running' },
  { key: 'NOT_A_FIT', label: 'Not a fit' },
  { key: 'ALL', label: 'All' },
]

const STATUS_ORDER: SetupRequestStatus[] = ['NEW', 'CONTACTED', 'LIST_RECEIVED', 'LOADED', 'RUNNING', 'NOT_A_FIT']

const SOURCE_LABELS: Record<string, string> = {
  landing: 'Home page',
  founding: '/founding (ads, outreach)',
  pricing: 'Pricing page',
  app: 'the app (Send us your list)',
}

const ALERTS_KEY = 'pp.setupAlerts'

function minutesSince(iso: string, now: number): number {
  return (now - new Date(iso).getTime()) / 60_000
}

/**
 * The setup queue — route `/admin/setup-requests` (LANDING_PAGE_PLAN.md, step 4).
 *
 * Every shop that books a setup on the landing page lands here, and the plan's promise is a
 * WhatsApp reply within 5 minutes, 8am to 6pm Monday to Saturday (rule 5). So the screen is built
 * around that one action: "Reply on WhatsApp" opens a chat with the first message already typed and
 * marks the request contacted, which stops the speed-to-lead clock. The page checks for new
 * requests every 30 seconds, shows the waiting count in the browser tab, and can raise a desktop
 * notification, for whoever is on the rota and keeps it open.
 */
export function AdminSetupRequestsPage() {
  const { showToast } = useToast()
  const [tab, setTab] = useState<Tab>('NEW')
  const [page, setPage] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [savingId, setSavingId] = useState<string | null>(null)
  const [alertsOn, setAlertsOn] = useState(() => {
    try {
      return localStorage.getItem(ALERTS_KEY) === 'on' && 'Notification' in window && Notification.permission === 'granted'
    } catch {
      return false
    }
  })

  const announce = useCallback(
    (arrived: SetupRequest[]) => {
      showToast(
        arrived.length === 1 ? `New setup request: ${arrived[0].businessName}` : `${arrived.length} new setup requests`,
        'info',
      )
      if (alertsOn && 'Notification' in window && Notification.permission === 'granted') {
        for (const request of arrived) {
          new Notification('Reply now: new setup request', {
            body: `${request.businessName}, ${formatWhatsApp(request.whatsapp)}`,
            tag: request.id,
          })
        }
      }
    },
    [alertsOn, showToast],
  )

  const { data, requests, counts, loading, error, refetch, replace } = useSetupRequests(
    { tab: tab === 'ALL' ? undefined : tab, page, size: PAGE_SIZE },
    announce,
  )

  // "Waiting 4 min" has to move on its own.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  // The waiting count in the browser tab, so a pinned tab says when somebody needs a reply.
  useEffect(() => {
    const base = 'Setup requests · Procurepaddy admin'
    document.title = counts && counts.waiting > 0 ? `(${counts.waiting}) ${base}` : base
    return () => {
      document.title = 'Procurepaddy'
    }
  }, [counts])

  async function toggleAlerts() {
    if (alertsOn) {
      setAlertsOn(false)
      try {
        localStorage.setItem(ALERTS_KEY, 'off')
      } catch {
        // Only this device's preference.
      }
      return
    }
    if (!('Notification' in window)) {
      showToast('This browser cannot show notifications. Keep this tab open: new requests appear here.', 'error')
      return
    }
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      showToast('Notifications are blocked for this site. Allow them in the browser settings.', 'error')
      return
    }
    setAlertsOn(true)
    try {
      localStorage.setItem(ALERTS_KEY, 'on')
    } catch {
      // Only this device's preference.
    }
  }

  function switchTab(next: Tab) {
    setTab(next)
    setPage(0)
  }

  const navigate = useNavigate()
  const auth = useAuth()

  /**
   * Into the shop's own workspace as Procurepaddy support, to load its products with its own
   * import (step 5). This browser must not already hold another shop's session: its unsent work
   * and on-device copy belong to that shop.
   */
  async function openWorkspace(request: SetupRequest) {
    if (!request.clientId) return
    if (auth.isAuthenticated && !(auth.user?.username === 'procurepaddy-support' && auth.client?.identifier === request.clientSlug)) {
      showToast(`This browser is signed in to ${auth.client?.name ?? 'another shop'}. Log out of that workspace first.`, 'error')
      return
    }
    try {
      const session = await setupRequestsApi.supportSession(request.clientId)
      auth.adoptTenantSession(session)
      navigate('/app/products/import')
    } catch (err: unknown) {
      showToast(isAppError(err) ? err.message : "We couldn't open that shop.", 'error')
    }
  }

  async function save(
    request: SetupRequest,
    payload: { status?: SetupRequestStatus; contacted?: boolean; note?: string },
  ) {
    setSavingId(request.id)
    try {
      const updated = await setupRequestsApi.update(request.id, payload)
      replace(updated)
      refetch()
    } catch (err: unknown) {
      showToast(isAppError(err) ? err.message : 'We could not save that.', 'error')
      refetch()
    } finally {
      setSavingId(null)
    }
  }

  async function copyNumber(request: SetupRequest) {
    try {
      await navigator.clipboard.writeText(formatWhatsApp(request.whatsapp))
      showToast('Number copied', 'success')
    } catch {
      showToast(formatWhatsApp(request.whatsapp), 'info')
    }
  }

  const tabCount = (key: Tab) =>
    !counts
      ? undefined
      : key === 'NEW'
        ? counts.waiting
        : key === 'IN_PROGRESS'
          ? counts.inProgress
          : key === 'RUNNING'
            ? counts.running
            : key === 'NOT_A_FIT'
              ? counts.notAFit
              : counts.all

  const showSkeleton = loading && !data
  const staffed = inStaffedHours(new Date(now))

  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-neutral-900">
            <PhoneIncoming className="h-5 w-5 text-primary-600" aria-hidden="true" />
            Setup requests
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            Shops that booked a setup on the Procurepaddy home page. Reply on WhatsApp within {REPLY_DUE_MINUTES} minutes,
            8am to 6pm Monday to Saturday, and ask for their product list.{' '}
            {staffed ? (
              <span className="font-medium text-neutral-800">Staffed hours now.</span>
            ) : (
              <span className="font-medium text-neutral-800">Outside staffed hours: reply first thing next working morning.</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-stretch gap-2">
          {counts && (
            <>
              <div className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-center">
                <p className="text-2xl font-bold text-neutral-900 tabular-nums">{counts.waiting}</p>
                <p className="text-xs text-neutral-600">waiting for a reply</p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-center">
                <p className="text-2xl font-bold text-neutral-900 tabular-nums">
                  {counts.medianMinutesToContact == null ? '–' : formatWait(counts.medianMinutesToContact)}
                </p>
                <p className="text-xs text-neutral-600">median reply, 30 days</p>
              </div>
            </>
          )}
          <Button variant="secondary" onClick={() => void toggleAlerts()} aria-pressed={alertsOn}>
            {alertsOn ? <Bell className="h-4 w-4" aria-hidden="true" /> : <BellOff className="h-4 w-4" aria-hidden="true" />}
            {alertsOn ? 'Alerts on' : 'Turn on alerts'}
          </Button>
        </div>
      </header>

      <div className="mt-5 flex flex-wrap gap-1 rounded-lg border border-neutral-200 bg-white p-1">
        {TABS.map((entry) => {
          const count = tabCount(entry.key)
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => switchTab(entry.key)}
              aria-current={tab === entry.key ? 'page' : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none ${
                tab === entry.key ? 'bg-primary-600 text-white' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
              }`}
            >
              {entry.label}
              {count !== undefined && <span className="ml-1.5 text-xs opacity-75">{count}</span>}
            </button>
          )
        })}
      </div>

      <div className="mt-4">
        {error && (
          <ErrorState
            variant={requests.length > 0 ? 'inline' : 'block'}
            title="We could not load the setup requests"
            message={error}
            onRetry={refetch}
            className={requests.length > 0 ? 'mb-4' : ''}
          />
        )}

        {showSkeleton && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        )}

        {!showSkeleton && requests.length > 0 && (
          <>
            <ul className={`space-y-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
              {requests.map((request) => (
                <SetupRequestRow
                  key={request.id}
                  request={request}
                  now={now}
                  saving={savingId === request.id}
                  onSave={(payload) => void save(request, payload)}
                  onCopy={() => void copyNumber(request)}
                  onOpenWorkspace={() => void openWorkspace(request)}
                />
              ))}
            </ul>
            <Pagination page={page} totalPages={data?.totalPages ?? 0} onPageChange={setPage} className="mt-6" />
          </>
        )}

        {!showSkeleton && !error && requests.length === 0 && (
          <EmptyState
            icon={Inbox}
            title={tab === 'NEW' ? 'Nobody is waiting' : 'Nothing here'}
            description={
              tab === 'NEW'
                ? 'Every request has had a reply. New ones appear here within 30 seconds, while this page is open.'
                : 'No setup requests in this state yet.'
            }
          />
        )}
      </div>
    </div>
  )
}

function SetupRequestRow({
  request,
  now,
  saving,
  onSave,
  onCopy,
  onOpenWorkspace,
}: {
  request: SetupRequest
  now: number
  saving: boolean
  onSave: (payload: { status?: SetupRequestStatus; contacted?: boolean; note?: string }) => void
  onCopy: () => void
  onOpenWorkspace: () => void
}) {
  const [editingNote, setEditingNote] = useState(false)
  const [note, setNote] = useState(request.note ?? '')
  const [files, setFiles] = useState<ProductListFile[] | null>(null)
  const { showToast } = useToast()
  const waiting = awaitingReply(request)
  const waitedMinutes = minutesSince(request.createdAt, now)
  const overdue = waiting && waitedMinutes > REPLY_DUE_MINUTES
  const replyMinutes = request.contactedAt
    ? (new Date(request.contactedAt).getTime() - new Date(request.createdAt).getTime()) / 60_000
    : null

  return (
    <li
      className={`flex flex-wrap items-start gap-4 rounded-lg border bg-white p-4 ${
        overdue ? 'border-danger-300' : 'border-neutral-200'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-neutral-900">{request.businessName}</h2>
          {request.founding ? <Badge variant="info">Founding</Badge> : <Badge>Regular plan</Badge>}
          {waiting && (
            <Badge variant={overdue ? 'danger' : 'warning'}>
              {overdue ? `Overdue · waiting ${formatWait(waitedMinutes)}` : `Waiting ${formatWait(waitedMinutes)}`}
            </Badge>
          )}
          {request.status === 'LIST_RECEIVED' && <Badge variant="info">List received</Badge>}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-700">
          <span className="flex items-center gap-1.5">
            <span className="font-medium tabular-nums">{formatWhatsApp(request.whatsapp)}</span>
            <button
              type="button"
              onClick={onCopy}
              className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
              aria-label={`Copy ${formatWhatsApp(request.whatsapp)}`}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </span>
          <span className="flex items-center gap-1.5">
            <Store className="h-3.5 w-3.5 shrink-0 text-neutral-500" aria-hidden="true" />
            {request.clientId && request.clientSlug ? (
              <Link to={`/admin/tenants/${request.clientId}`} className="text-primary-600 hover:underline">
                Account: {request.clientSlug}
              </Link>
            ) : (
              'No account yet'
            )}
          </span>
        </div>

        <p className="mt-2 text-xs text-neutral-600">
          Booked {formatDateTime(request.createdAt)} from {SOURCE_LABELS[request.source] ?? request.source}
          {replyMinutes != null && ` · first reply after ${formatWait(replyMinutes)}`}
        </p>

        {request.listFiles > 0 && request.clientId && (
          <div className="mt-2">
            <button
              type="button"
              aria-expanded={files != null}
              onClick={() => {
                if (files) setFiles(null)
                else
                  setupRequestsApi
                    .listFiles(request.clientId!)
                    .then(setFiles)
                    .catch(() => showToast('We could not load the files.', 'error'))
              }}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:underline"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              {request.listFiles} {request.listFiles === 1 ? 'file' : 'files'} sent with Send us your list
            </button>
            {files && (
              <ul className="mt-2 flex flex-col gap-1">
                {files.map((file) => (
                  <li key={file.id}>
                    <button
                      type="button"
                      onClick={() =>
                        void setupRequestsApi
                          .downloadFile(request.clientId!, file)
                          .catch(() => showToast(`We could not download ${file.fileName}.`, 'error'))
                      }
                      className="inline-flex items-center gap-1.5 text-sm text-neutral-800 hover:underline"
                    >
                      <Download className="h-3.5 w-3.5 text-neutral-500" aria-hidden="true" />
                      {file.fileName}
                      <span className="text-neutral-500">· {formatDateTime(file.uploadedAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {editingNote ? (
          <form
            className="mt-3 flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault()
              onSave({ note })
              setEditingNote(false)
            }}
          >
            <label className="sr-only" htmlFor={`note-${request.id}`}>
              Note for {request.businessName}
            </label>
            <input
              id={`note-${request.id}`}
              value={note}
              maxLength={500}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Two branches; call back Friday"
              className="min-w-0 flex-1 rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
            />
            <div className="flex gap-2">
              <Button type="submit" variant="primary" loading={saving}>
                Save note
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setNote(request.note ?? '')
                  setEditingNote(false)
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : request.note ? (
          <p className="mt-2 rounded-md bg-neutral-50 px-2.5 py-1.5 text-sm text-neutral-700">
            {request.note}{' '}
            <button type="button" onClick={() => setEditingNote(true)} className="font-medium text-primary-600 hover:underline">
              Edit
            </button>
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setEditingNote(true)}
            className="mt-2 text-sm font-medium text-primary-600 hover:underline"
          >
            Add a note
          </button>
        )}
      </div>

      <div className="flex w-full flex-col gap-2 sm:w-56">
        <a
          href={replyLink(request)}
          target="_blank"
          rel="noreferrer"
          onClick={() => {
            if (request.status === 'NEW') onSave({ status: 'CONTACTED' })
            else if (waiting) onSave({ contacted: true })
          }}
          className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold ${
            waiting ? 'bg-action text-white hover:bg-action-hover' : 'border border-neutral-200 text-neutral-800 hover:bg-neutral-50'
          }`}
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          {waiting ? 'Reply on WhatsApp' : 'Open WhatsApp chat'}
        </a>
        {request.clientId && (
          <Button variant="secondary" onClick={onOpenWorkspace}>
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Open their workspace
          </Button>
        )}
        <label className="sr-only" htmlFor={`status-${request.id}`}>
          Status of {request.businessName}
        </label>
        <select
          id={`status-${request.id}`}
          value={request.status}
          disabled={saving}
          onChange={(event) => onSave({ status: event.target.value as SetupRequestStatus })}
          className="min-h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none disabled:opacity-60"
        >
          {STATUS_ORDER.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>
    </li>
  )
}
