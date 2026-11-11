import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, buttonClassName } from '@/components/Button'
import { expectedApi } from '@/features/expected/api/expectedApi'
import { expectedCopy } from '@/features/expected/copy'
import { orderMoney, whenText } from '@/features/expected/expected'
import type { ExpectedDelivery } from '@/features/expected/types'
import { isAppError } from '@/types/api'

const text = expectedCopy.approval

export interface ApprovalStepProps {
  order: ExpectedDelivery
  supplier: string
  /** The viewer can approve and send (SEND_PURCHASE_ORDER). */
  canSend: boolean
  /** The viewer sent it for approval. */
  isAsker: boolean
  changeHref: string
  onUpdated: (order: ExpectedDelivery) => void
}

/**
 * The order page's next step while an order is held for approval (plan section 11.5, mockups 3B/3C).
 * The approver gets one main button, "Approve and send", which leaves the order on the usual send
 * step; "Ask for a change" opens a note in place. Whoever made it sees what happens next, or the
 * change asked for with "Change order".
 */
export function ApprovalStep({ order, supplier, canSend, isAsker, changeHref, onUpdated }: ApprovalStepProps) {
  const [asking, setAsking] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'approve' | 'ask' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const approval = order.approval
  if (!approval) return null
  const asker = approval.askedByName ?? text.someone
  const total = order.total != null ? orderMoney(order.total) : null

  async function approve() {
    setBusy('approve')
    setError(null)
    try {
      onUpdated(await expectedApi.approve(order.id))
    } catch (err: unknown) {
      setError(isAppError(err) ? err.message : text.failed)
    } finally {
      setBusy(null)
    }
  }

  async function askChange() {
    if (note.trim() === '') return
    setBusy('ask')
    setError(null)
    try {
      onUpdated(await expectedApi.askChange(order.id, note.trim()))
      setAsking(false)
      setNote('')
    } catch (err: unknown) {
      setError(isAppError(err) ? err.message : text.failed)
    } finally {
      setBusy(null)
    }
  }

  const box = 'flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4'

  if (approval.status === 'CHANGE_ASKED') {
    const by = approval.changeAskedByName ?? text.someone
    return (
      <section aria-label={text.label} className={box}>
        <p className="font-semibold text-neutral-900">{isAsker || !canSend ? text.changeAskedYou(by) : text.changeAskedWaiting(asker)}</p>
        {approval.changeNote && <p className="rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-800">“{approval.changeNote}”</p>}
        {(isAsker || !canSend) && (
          <Link to={changeHref} className={buttonClassName('action', 'w-full')}>
            {text.changeOrder}
          </Link>
        )}
        {canSend && !isAsker && (
          <Button variant="secondary" className="w-full" loading={busy === 'approve'} onClick={() => void approve()}>
            {text.approveAnyway}
          </Button>
        )}
        {error && <p role="alert" className="text-sm text-danger-700">{error}</p>}
      </section>
    )
  }

  // WAITING
  if (!canSend) {
    return (
      <section aria-label={text.label} className={box}>
        <p className="font-semibold text-neutral-900">{text.waitingYou}</p>
        <p className="text-sm text-neutral-600">{text.waitingYouNote(supplier)}</p>
        <div className="text-sm">
          <Link to={changeHref} className="rounded-sm font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none">
            {text.changeOrder}
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section aria-label={text.label} className={box}>
      <p className="font-semibold text-neutral-900">{text.wantsToSend(asker, supplier)}</p>
      <p className="text-sm text-neutral-600">
        {[approval.askedAt ? text.askedWhen(whenText(approval.askedAt)) : null, total].filter(Boolean).join(' · ')}
      </p>
      {approval.note && <p className="rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-800">“{approval.note}”</p>}
      {!asking && (
        <>
          <Button variant="action" className="w-full" loading={busy === 'approve'} onClick={() => void approve()}>
            {text.approve}
          </Button>
          <div className="text-sm">
            <button
              type="button"
              onClick={() => setAsking(true)}
              className="rounded-sm font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
              {text.askChange}
            </button>
          </div>
        </>
      )}
      {asking && (
        <div className="flex flex-col gap-2">
          <label htmlFor="po-change-note" className="text-sm font-medium text-neutral-800">
            {text.whatToChange(asker)}
          </label>
          <textarea
            id="po-change-note"
            rows={3}
            maxLength={500}
            autoFocus
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-base text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none sm:text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="action" disabled={note.trim() === ''} loading={busy === 'ask'} onClick={() => void askChange()}>
              {text.sendTo(asker)}
            </Button>
            <Button
              variant="quiet"
              onClick={() => {
                setAsking(false)
                setNote('')
              }}
            >
              {text.cancel}
            </Button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-danger-700">{error}</p>}
    </section>
  )
}
