import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Stamp, type StampKind } from '@/components/Stamp'
import { syncCatalog } from '@/features/catalog/catalogStore'
import { useCatalogState } from '@/features/catalog/useCatalog'
import { describeDraft } from '@/features/drafts/describeDraft'
import { listDrafts, type StoredDraft } from '@/features/drafts/draftStore'
import { useDraftCount } from '@/features/drafts/useDraft'
import { discardOp, processOutbox, retryOp, sendAvailableInstead } from '@/features/outbox/outboxStore'
import type { OutboxOp } from '@/features/outbox/types'
import { useOutboxState } from '@/features/outbox/useOutbox'
import { SyncIcon } from '@/features/sync/SyncIcon'
import { TONE_CLASS } from '@/features/sync/syncTone'
import { useSyncStatus, type SyncStatus } from '@/features/sync/useSyncStatus'

const KIND_LABEL: Record<OutboxOp['kind'], string> = {
  STOCK_IN: 'Stock in',
  STOCK_OUT: 'Stock out',
  COUNT: 'Count',
}

/** "10:42" today, "3 Oct, 10:42" otherwise. */
function at(ms: number): string {
  const when = new Date(ms)
  const time = when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return when.toDateString() === new Date().toDateString()
    ? time
    : `${when.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${time}`
}

/** The sentence at the top of the centre: where things stand, and what (if anything) to do. */
function headline(status: SyncStatus): string {
  const n = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`
  switch (status.kind) {
    case 'attention':
      return `The server refused ${n(status.attention, 'change')} once ${status.attention === 1 ? 'it' : 'they'} arrived. Decide what to do with ${status.attention === 1 ? 'it' : 'each'} below.`
    case 'offline':
      return status.waiting > 0
        ? `You're offline. ${n(status.waiting, 'stock change')} ${status.waiting === 1 ? 'is' : 'are'} saved on this phone and will be sent when it reconnects.`
        : "You're offline. Stock you record is saved on this phone and sent when it reconnects."
    case 'sending':
      return `Sending ${status.sendingPosition} of ${status.sendingTotal}…`
    case 'waiting':
      return `${n(status.waiting, 'stock change')} waiting to send. The server couldn't be reached last time; this phone keeps trying on its own.`
    default:
      return 'All caught up. Everything recorded on this phone has been sent.'
  }
}

/**
 * Everything this phone is holding for the server, in one place (A6): stock changes waiting to
 * send (and the ones just sent, stamped), forms not finished yet, and how fresh the product list
 * on the phone is. Opened from the top bar's sync pill.
 */
export function SyncCentre({ open, onClose }: { open: boolean; onClose: () => void }) {
  const status = useSyncStatus()
  const { ops, recentlySent } = useOutboxState()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="On this phone"
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <div className={`flex flex-col gap-3 rounded-md border px-4 py-3 ${TONE_CLASS[status.tone === 'quiet' ? 'good' : status.tone]}`}>
          <div className="flex items-start gap-2.5">
            <SyncIcon status={status} className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-sm">
              {headline(status)}
              {status.ageDays >= 3
                ? ` The oldest has waited ${status.ageDays} days — connect this phone today, or other phones' figures stay wrong.`
                : status.ageDays >= 1
                  ? ' Some have waited more than a day — connect this phone when you can.'
                  : ''}
            </p>
          </div>
          {status.kind === 'waiting' && (
            <div>
              <Button variant="secondary" onClick={() => void processOutbox({ force: true })}>
                Send now
              </Button>
            </div>
          )}
        </div>

        {(ops.length > 0 || recentlySent.length > 0) && (
          <section aria-labelledby="sync-stock-heading" className="flex flex-col gap-2">
            <h3 id="sync-stock-heading" className="text-sm font-semibold text-neutral-900">
              Stock changes
            </h3>
            <p className="text-xs text-neutral-500">
              Sent in the order they were made, dated when they were made. Waiting ones aren't in the stock figures yet.
            </p>
            <ul className="flex flex-col divide-y divide-neutral-100 rounded-md border border-neutral-200">
              {ops.map((op) => (
                <ReceiptLine key={op.id} op={op} stamp={op.status === 'needs_attention' ? 'check' : 'recorded'} />
              ))}
              {recentlySent.map((op) => (
                <ReceiptLine key={op.id} op={op} stamp="synced" sentAt={op.sentAt} />
              ))}
            </ul>
          </section>
        )}

        <DraftsSection open={open} onLeave={onClose} />
        <CatalogSection online={status.online} />
      </div>
    </Modal>
  )
}

/** A SYNCED stamp lands (plan §2 motion) when the change went up moments ago, not on every open. */
const JUST_NOW_MS = 4_000

/** One change, the way a receipt prints it: what, how much, which product, when — and its stamp. */
function ReceiptLine({ op, stamp, sentAt }: { op: OutboxOp; stamp: StampKind; sentAt?: number }) {
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-neutral-900">
            <span className="font-medium">{KIND_LABEL[op.kind]}</span> · {op.summary}
          </p>
          <p className="truncate text-sm text-neutral-600">{op.productName}</p>
          <p className="mt-0.5 text-xs tabular-nums text-neutral-500">
            Recorded {at(op.createdAt)}
            {sentAt != null && ` · sent ${at(sentAt)}`}
          </p>
        </div>
        <Stamp kind={stamp} land={sentAt != null && Date.now() - sentAt < JUST_NOW_MS} />
      </div>
      {stamp === 'check' && op.problem && (
        <div className="flex flex-col gap-2 rounded-md bg-warning-50 px-3 py-2">
          <p className="text-sm text-warning-900">{op.problem.message}</p>
          <div className="flex flex-wrap gap-2">
            {op.problem.kind === 'oversell' && op.problem.available > 0 && (
              <Button onClick={() => void sendAvailableInstead(op.id)}>Send {op.problem.available} instead</Button>
            )}
            {op.problem.kind === 'refused' && (
              <Button variant="secondary" onClick={() => void retryOp(op.id)}>
                Try again
              </Button>
            )}
            <Button variant="secondary" onClick={() => void discardOp(op.id)}>
              Discard
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}

/** Forms started and not submitted (A5), each a link back to where it picks up. */
function DraftsSection({ open, onLeave }: { open: boolean; onLeave: () => void }) {
  const count = useDraftCount()
  const [drafts, setDrafts] = useState<StoredDraft[]>([])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void listDrafts().then((found) => {
      if (!cancelled) setDrafts(found)
    })
    return () => {
      cancelled = true
    }
  }, [open, count])

  if (count === 0 || drafts.length === 0) return null
  return (
    <section aria-labelledby="sync-drafts-heading" className="flex flex-col gap-2">
      <h3 id="sync-drafts-heading" className="text-sm font-semibold text-neutral-900">
        Unfinished forms
      </h3>
      <p className="text-xs text-neutral-500">Kept on this phone only. They're submitted from the form, once you're online.</p>
      <ul className="flex flex-col divide-y divide-neutral-100 rounded-md border border-neutral-200">
        {drafts.map((draft) => {
          const summary = describeDraft(draft)
          return (
            <li key={draft.key} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-900">{summary.title}</p>
                <p className="truncate text-xs tabular-nums text-neutral-500">
                  {summary.detail ? `${summary.detail} · ` : ''}saved {at(draft.savedAt)}
                </p>
              </div>
              <Link
                to={summary.to}
                onClick={onLeave}
                className="shrink-0 rounded-sm px-1 text-sm font-medium text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                Continue
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** How fresh the product list on this phone is (A3), and a way to check now. */
function CatalogSection({ online }: { online: boolean }) {
  const catalog = useCatalogState()
  const [checking, setChecking] = useState(false)
  if (catalog.phase === 'off' || catalog.phase === 'starting') return null

  const count = catalog.loaded.toLocaleString()
  let sentence: string
  if (catalog.phase === 'unavailable') {
    sentence = "This phone doesn't have room for a copy of your products, so the list comes from the server and needs a connection."
  } else if (catalog.phase === 'loading') {
    sentence =
      catalog.total != null
        ? `Downloading your products: ${count} of ${catalog.total.toLocaleString()}. Until it's done, the list comes from the server.`
        : `Downloading your products: ${count} so far.`
  } else if (catalog.behind) {
    sentence = `${count} products on this phone. The server couldn't be reached to check for changes, so they're as of ${catalog.syncedAt != null ? at(catalog.syncedAt) : 'the last check'}.`
  } else {
    sentence = `${count} products on this phone, up to date as of ${catalog.syncedAt != null ? at(catalog.syncedAt) : 'now'}.`
  }

  return (
    <section aria-labelledby="sync-catalog-heading" className="flex flex-col gap-2">
      <h3 id="sync-catalog-heading" className="text-sm font-semibold text-neutral-900">
        Products
      </h3>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm text-neutral-600">{sentence}</p>
        {catalog.phase === 'ready' && (
          <Button
            variant="secondary"
            loading={checking}
            disabled={!online}
            onClick={async () => {
              setChecking(true)
              await syncCatalog()
              setChecking(false)
            }}
          >
            Check now
          </Button>
        )}
      </div>
    </section>
  )
}
