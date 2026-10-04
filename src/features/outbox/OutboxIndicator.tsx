import { useState } from 'react'
import { CloudUpload, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { discardOp, retryOp, sendAvailableInstead } from '@/features/outbox/outboxStore'
import type { OutboxOp } from '@/features/outbox/types'
import { useOutboxState } from '@/features/outbox/useOutbox'

const DAY_MS = 24 * 60 * 60 * 1000

const KIND_LABEL: Record<OutboxOp['kind'], string> = {
  STOCK_IN: 'Stock in',
  STOCK_OUT: 'Stock out',
  COUNT: 'Count',
}

/** "10:42, today" / "3 Oct, 10:42" — when it was recorded on this phone. */
function recordedAt(ms: number): string {
  const at = new Date(ms)
  const time = at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return at.toDateString() === new Date().toDateString()
    ? `${time}, today`
    : `${at.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${time}`
}

/**
 * The top bar's word on stock recorded on this phone and not yet sent (A4): "3 waiting to send",
 * or "1 needs you" when the server refused something once it arrived. Opens the list, where each
 * refused write can be resolved. Absent when nothing is waiting.
 *
 * Waiting writes older than a day are called out (Square's rule for offline payments, softened:
 * stock movements don't expire, but a phone that hasn't connected in a day should be noticed).
 */
export function OutboxIndicator() {
  const { ops, sending } = useOutboxState()
  const [open, setOpen] = useState(false)
  if (ops.length === 0) return null

  const attention = ops.filter((op) => op.status === 'needs_attention').length
  const oldest = Math.min(...ops.map((op) => op.createdAt))
  const stale = Date.now() - oldest > DAY_MS

  const label =
    attention > 0
      ? `${attention} need${attention === 1 ? 's' : ''} you`
      : sending
        ? `Sending ${ops.length}…`
        : `${ops.length} waiting to send`

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
          attention > 0 || stale
            ? 'border-warning-200 bg-warning-50 text-warning-800'
            : 'border-primary-100 bg-primary-50 text-primary-800'
        }`}
      >
        {attention > 0 ? (
          <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <CloudUpload className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {label}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Recorded on this phone"
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-neutral-600">
            These stock changes are saved on this phone and are sent in the order they were made, as soon as the
            server can be reached. Nothing here is in the stock figures yet.
            {stale && ' Some have waited more than a day — connect this phone when you can.'}
          </p>
          <ul className="flex flex-col divide-y divide-neutral-100 rounded-md border border-neutral-200">
            {ops.map((op) => (
              <li key={op.id} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-sm text-neutral-900">
                    <span className="font-medium">{KIND_LABEL[op.kind]}</span> · {op.summary} ·{' '}
                    <span className="text-neutral-600">{op.productName}</span>
                  </p>
                  <span className="text-xs tabular-nums text-neutral-500">{recordedAt(op.createdAt)}</span>
                </div>
                {op.status === 'needs_attention' && op.problem ? (
                  <div className="flex flex-col gap-2 rounded-md bg-warning-50 px-3 py-2">
                    <p className="text-sm text-warning-900">{op.problem.message}</p>
                    <div className="flex flex-wrap gap-2">
                      {op.problem.kind === 'oversell' && op.problem.available > 0 && (
                        <Button onClick={() => void sendAvailableInstead(op.id)}>
                          Send {op.problem.available} instead
                        </Button>
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
                ) : (
                  <p className="text-xs text-neutral-500">
                    {op.attempts > 0 ? 'Waiting for a connection' : 'Sending…'}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </Modal>
    </>
  )
}
