import { useState } from 'react'
import { ArrowLeftRight, Ellipsis, Hand, Hash, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/Button'
import { useToast } from '@/components/useToast'
import { CANCEL_REASON_LABELS } from '@/features/selling/sale/cancelReasons'
import { salesReportApi } from '@/features/selling/sales/salesReportApi'
import type { SaleCancelReason, SaleDetail } from '@/features/selling/sales/types'
import { isAppError } from '@/types/api'

const REASONS: { value: SaleCancelReason; icon: LucideIcon }[] = [
  { value: 'WRONG_ITEM', icon: ArrowLeftRight },
  { value: 'WRONG_AMOUNT', icon: Hash },
  { value: 'CHANGED_MIND', icon: Hand },
  { value: 'OTHER', icon: Ellipsis },
]

/**
 * "Cancel sale", opened in place (selling till Step 3, owner 2026-11-16): one tap on a picture for why, then
 * Cancel sale - for the cashier in the first two minutes, or anyone who can cancel sales - or "Ask a manager
 * to cancel" for everyone else. Nothing is erased either way.
 */
export function CancelSalePanel({
  saleId,
  canCancelNow,
  canAsk,
  blocked,
  onDone,
}: {
  saleId: string
  /** The cashier in the first two minutes, or someone with Cancel sales. */
  canCancelNow: boolean
  /** The cashier's own sale, past two minutes: they may ask. */
  canAsk: boolean
  /** Why it can't be cancelled from here right now (offline, still on the phone) - said instead. */
  blocked?: string | null
  onDone: (sale: SaleDetail, kind: 'cancelled' | 'requested') => void
}) {
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<SaleCancelReason | null>(null)
  const [busy, setBusy] = useState(false)

  if (!canCancelNow && !canAsk) return null
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center text-sm font-semibold text-danger-700 hover:underline"
      >
        Cancel sale
      </button>
    )
  }

  async function go() {
    if (!reason) return
    setBusy(true)
    try {
      const sale = canCancelNow ? await salesReportApi.cancelSale(saleId, reason) : await salesReportApi.askToCancel(saleId, reason)
      setOpen(false)
      onDone(sale, sale.cancelState === 'REQUESTED' ? 'requested' : 'cancelled')
    } catch (err) {
      showToast(isAppError(err) ? err.message : "Couldn't do that. Try again.", 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="Cancel this sale" className="flex w-full flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3">
      <p className="text-sm font-semibold text-neutral-900">Why cancel it?</p>
      <div role="radiogroup" aria-label="Why" className="grid grid-cols-2 gap-2">
        {REASONS.map(({ value, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={reason === value}
            onClick={() => setReason(value)}
            className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border-2 px-2 text-sm font-semibold ${
              reason === value ? 'border-primary-600 bg-primary-50 text-primary-900' : 'border-neutral-200 text-neutral-800 hover:bg-neutral-50'
            }`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {CANCEL_REASON_LABELS[value]}
          </button>
        ))}
      </div>
      {blocked ? (
        <p className="text-sm text-neutral-700">{blocked}</p>
      ) : (
        <Button
          variant={canCancelNow ? 'danger' : 'action'}
          disabled={!reason}
          loading={busy}
          onClick={() => void go()}
          className="min-h-12 text-base"
        >
          {canCancelNow ? 'Cancel sale' : 'Ask a manager to cancel'}
        </Button>
      )}
      <button type="button" onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center self-center text-sm font-medium text-primary-700 hover:underline">
        Keep the sale
      </button>
    </section>
  )
}

/**
 * Where cancelling a sale has got to (selling till Step 3): asked and waiting - with Approve and Decline for
 * someone who can cancel sales - kept, or cancelled, with who and why.
 */
export function CancelStateBox({
  sale,
  canAnswer,
  onAnswered,
}: {
  sale: SaleDetail
  canAnswer: boolean
  onAnswered: (sale: SaleDetail, approved: boolean) => void
}) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState<'approve' | 'decline' | null>(null)
  const why = sale.cancelReason ? CANCEL_REASON_LABELS[sale.cancelReason] : null
  const at = (iso?: string) =>
    iso ? new Date(iso).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' }) : ''

  async function answer(approve: boolean) {
    setBusy(approve ? 'approve' : 'decline')
    try {
      const next = approve ? await salesReportApi.approveCancel(sale.saleId) : await salesReportApi.declineCancel(sale.saleId)
      onAnswered(next, approve)
    } catch (err) {
      showToast(isAppError(err) ? err.message : "Couldn't do that. Try again.", 'error')
    } finally {
      setBusy(null)
    }
  }

  if (sale.cancelState === 'REQUESTED') {
    return (
      <div role="status" className="flex flex-col gap-3 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-900" data-cancel-state="requested">
        <p>
          <span className="font-semibold">{sale.cancelRequestedByName ?? 'Someone'} asks to cancel this sale</span>
          {why && ` · Why: ${why}`}
          {sale.cancelNote && ` · “${sale.cancelNote}”`}
          {sale.cancelRequestedAt && ` · ${at(sale.cancelRequestedAt)}`}
        </p>
        {canAnswer ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="danger" loading={busy === 'approve'} disabled={busy != null} onClick={() => void answer(true)}>
              Approve
            </Button>
            <Button variant="secondary" loading={busy === 'decline'} disabled={busy != null} onClick={() => void answer(false)}>
              Decline
            </Button>
          </div>
        ) : (
          <p className="font-medium">Waiting for a manager.</p>
        )}
      </div>
    )
  }
  if (sale.cancelState === 'DECLINED') {
    return (
      <p className="rounded-lg bg-neutral-100 px-4 py-3 text-sm text-neutral-700" data-cancel-state="declined">
        {sale.cancelDecidedByName ?? 'A manager'} kept this sale{sale.cancelDecidedAt ? ` · ${at(sale.cancelDecidedAt)}` : ''}.
      </p>
    )
  }
  if (sale.cancelState === 'CANCELLED') {
    return (
      <p className="rounded-lg bg-neutral-100 px-4 py-3 text-sm text-neutral-700" data-cancel-state="cancelled">
        Cancelled by {sale.cancelDecidedByName ?? 'someone'}
        {why && ` · ${why}`}
        {sale.cancelRequestedByName && sale.cancelRequestedByName !== sale.cancelDecidedByName && ` · asked by ${sale.cancelRequestedByName}`}
        {sale.cancelDecidedAt && ` · ${at(sale.cancelDecidedAt)}`}
      </p>
    )
  }
  return null
}
