import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Printer, Share2 } from 'lucide-react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { Badge, type BadgeVariant } from '@/components/Badge'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { TextField } from '@/components/TextField'
import { useToast } from '@/components/useToast'
import { queryClient } from '@/data/queryClient'
import { useWorkingBranch } from '@/features/branches/useWorkingBranch'
import { submitTransfer } from '@/features/outbox/outboxStore'
import { formatDateTime } from '@/features/products/formatters'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import { formatNumber, stockUnitWord } from '@/features/products/unitCopy'
import { resolveUnitSymbol } from '@/features/products/unitSet'
import { transfersApi } from '@/features/transfers/transfersApi'
import { isOpen, STATUS_LABEL, type Transfer, type TransferLine, type TransferStatus } from '@/features/transfers/types'
import { transferKeys, usePendingTransfers, useTransfer } from '@/features/transfers/useTransfers'
import { isAppError } from '@/types/api'

const STATUS_VARIANT: Record<TransferStatus, BadgeVariant> = {
  ON_THE_WAY: 'info',
  PARTLY_RECEIVED: 'info',
  RECEIVED: 'success',
  RECEIVED_SHORT: 'warning',
  CANCELLED: 'neutral',
}

/** Two minutes to take a waybill back, like every write (UX §5.4). */
const UNDO_MS = 2 * 60 * 1000

/** "10 crates" as typed when it was typed in a pack, else the stock-unit figure - the server words it. */
function sentText(line: TransferLine): string {
  return line.sentText ?? formatNumber(line.quantitySent)
}

/** "3 pieces", "2 kg": a figure in this line's stock unit. */
function useAmount() {
  const { options } = useUnitOfMeasureOptions()
  return (line: TransferLine, quantity: number) =>
    `${formatNumber(quantity)} ${stockUnitWord(resolveUnitSymbol(line.unitOfMeasure, options), quantity)}`.trim()
}

type Shortfall = 'missing' | 'damaged' | 'later'

interface ReceiveEntry {
  received: string
  why: Shortfall
}

/**
 * One waybill (MULTI_BRANCH_UX_PLAN.md §5.4-5.7): who sent it, who carried it, what was on it, and -
 * at the receiving branch - the one-tap "Received as sent", or the numbers as they arrived. The sender
 * shares it on WhatsApp; nothing on it is ever edited, only received, closed, cancelled or checked.
 */
export function TransferDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { user } = useAuth()
  const permissions = user?.type === 'tenant' ? user.permissions : []
  const { recordable } = useWorkingBranch()
  const recordableIds = useMemo(() => new Set(recordable.map((branch) => branch.id)), [recordable])
  const { data: transfer, loading, error, refetch, setData } = useTransfer(id)
  const pending = usePendingTransfers()
  const queuedSend = pending.find((op) => op.kind === 'TRANSFER_SEND' && op.payload.id === id)
  const queuedReceipts = pending.filter((op) => op.kind === 'TRANSFER_RECEIVE' && op.transferId === id)
  const justSent = (location.state as { justSent?: boolean } | null)?.justSent === true

  const [busy, setBusy] = useState<'cancel' | 'close' | 'check' | null>(null)
  const [confirm, setConfirm] = useState<'cancel' | 'close' | null>(null)
  const [checkNote, setCheckNote] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  // The waybill was queued and has since been sent: read it from the server.
  useEffect(() => {
    if (!queuedSend && !transfer && id) refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queuedSend == null])

  if (!transfer && queuedSend) {
    return (
      <Page>
        <h1 className="text-2xl font-semibold text-neutral-900">Waybill</h1>
        <div className="rounded-lg border border-neutral-200 bg-white p-4" data-receipt="recorded">
          <p className="font-medium text-neutral-900">{queuedSend.summary}</p>
          <p className="mt-1 text-sm text-neutral-600">
            Saved on this phone · not sent yet. It goes when you're connected, and gets its waybill number then.
          </p>
          <p className="mt-2 text-xs text-neutral-500">Share waits until it is sent, so the number on it is real.</p>
        </div>
      </Page>
    )
  }
  if (loading) {
    return (
      <Page>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </Page>
    )
  }
  if (error || !transfer) {
    return (
      <Page>
        <ErrorState title="Couldn't open this transfer" message={error ?? 'Not found.'} onRetry={refetch} />
      </Page>
    )
  }

  const atFrom = recordableIds.has(transfer.fromBranchId)
  const atTo = recordableIds.has(transfer.toBranchId)
  const open = isOpen(transfer)
  const nothingReceived = transfer.lines.every((line) => line.quantityReceived + line.quantityMissing + line.quantityDamaged === 0)
  const canReceive = open && atTo && permissions.includes(PERMISSIONS.STOCK_IN) && queuedReceipts.length === 0
  const canCancel = transfer.status === 'ON_THE_WAY' && nothingReceived && (atFrom || permissions.includes(PERMISSIONS.MANAGE_BRANCHES))
  // The sender's side decides the rest isn't coming (UX §5.5); an owner records everywhere, so is on it.
  const canClose = open && atFrom
  const canCheck = transfer.missing > 0 && atFrom && atTo
  const undoOpen = justSent && canCancel && Date.now() - new Date(transfer.sentAt).getTime() < UNDO_MS

  async function act(kind: 'cancel' | 'close' | 'check') {
    if (!transfer) return
    setBusy(kind)
    setProblem(null)
    try {
      const next =
        kind === 'cancel'
          ? await transfersApi.cancel(transfer.id)
          : kind === 'close'
            ? await transfersApi.close(transfer.id)
            : await transfersApi.checkMissing(transfer.id, checkNote.trim())
      setData(next)
      void queryClient.invalidateQueries({ queryKey: transferKeys.all })
      showToast(
        kind === 'cancel'
          ? `Cancelled. The stock is back at ${transfer.fromBranchName}.`
          : kind === 'close'
            ? `Closed. What didn't arrive is marked missing.`
            : 'Checked.',
        'success',
      )
      if (kind === 'cancel' && justSent) navigate('/app/transfers', { replace: true })
    } catch (err) {
      setProblem(isAppError(err) ? err.message : "Couldn't do that. Try again.")
    } finally {
      setBusy(null)
      setConfirm(null)
    }
  }

  function share() {
    if (!transfer) return
    window.open(`https://wa.me/?text=${encodeURIComponent(transfer.shareText)}`, '_blank', 'noopener')
  }

  return (
    <Page>
      <div className="flex items-start gap-3">
        <Link to="/app/transfers" aria-label="Back to transfers" className="mt-1 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 print:hidden">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-neutral-900">{transfer.waybill}</h1>
            <Badge variant={STATUS_VARIANT[transfer.status]}>{STATUS_LABEL[transfer.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-neutral-600">
            From <span className="font-medium text-neutral-900">{transfer.fromBranchName}</span> to{' '}
            <span className="font-medium text-neutral-900">{transfer.toBranchName}</span>
          </p>
          <p className="mt-0.5 text-sm text-neutral-500">
            Sent {formatDateTime(transfer.sentAt)}
            {transfer.sentByName && ` by ${transfer.sentByName}`}
            {transfer.carriedByName && ` · carried by ${transfer.carriedByName}`}
            {transfer.carriedByPhone && ` (${transfer.carriedByPhone})`}
          </p>
          {transfer.receivedAt && (
            <p className="mt-0.5 text-sm text-neutral-500">
              Received {formatDateTime(transfer.receivedAt)}
              {transfer.receivedByName && ` by ${transfer.receivedByName}`}
            </p>
          )}
        </div>
      </div>

      {justSent && (
        <div role="status" className="rounded-lg border border-accent-200 bg-accent-50 p-4 print:hidden" data-receipt="synced">
          <p className="font-medium text-accent-900">
            {transfer.status === 'RECEIVED' ? `Moved to ${transfer.toBranchName}.` : `On the way to ${transfer.toBranchName}.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {transfer.status !== 'RECEIVED' && (
              <Button variant="action" onClick={share}>
                <Share2 className="h-4 w-4" aria-hidden="true" />
                Share on WhatsApp
              </Button>
            )}
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" aria-hidden="true" />
              Print
            </Button>
            {undoOpen && (
              <Button variant="secondary" loading={busy === 'cancel'} onClick={() => void act('cancel')}>
                Undo
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate('/app/transfers')}>
              Done
            </Button>
          </div>
        </div>
      )}

      {transfer.missing > 0 && (
        <div role="status" className="rounded-lg border border-warning-200 bg-warning-50 p-4" data-transfer-missing>
          <p className="font-medium text-warning-900">
            {formatNumber(transfer.missing)} didn't arrive — {transfer.fromBranchName} and the owner can see it.
          </p>
          {canCheck && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <TextField
                  id="missing-note"
                  label="What happened to it?"
                  hint="“Driver paid for it”, “Found in the van”."
                  value={checkNote}
                  maxLength={1000}
                  onChange={(event) => setCheckNote(event.target.value)}
                />
              </div>
              <Button variant="secondary" disabled={checkNote.trim() === ''} loading={busy === 'check'} onClick={() => void act('check')}>
                Mark checked
              </Button>
            </div>
          )}
        </div>
      )}
      {transfer.missingCheckedAt && (
        <p className="text-sm text-neutral-600">
          Missing stock checked {formatDateTime(transfer.missingCheckedAt)}
          {transfer.missingCheckedByName && ` by ${transfer.missingCheckedByName}`}: “{transfer.missingNote}”
        </p>
      )}

      {queuedReceipts.length > 0 && (
        <p role="status" className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700" data-receipt="recorded">
          Received on this phone · not sent yet. It goes when you're connected.
        </p>
      )}

      {canReceive ? (
        <ReceiveForm transfer={transfer} onDone={(next) => setData(next)} />
      ) : (
        <WaybillLines transfer={transfer} />
      )}

      {transfer.note && <p className="text-sm text-neutral-700">Note: {transfer.note}</p>}

      {problem && (
        <p role="alert" className="rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {problem}
        </p>
      )}

      {(canClose || (canCancel && !undoOpen) || (!justSent && open)) && (
        <div className="flex flex-wrap gap-2 print:hidden">
          {!justSent && open && atFrom && (
            <Button variant="secondary" onClick={share}>
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Share on WhatsApp
            </Button>
          )}
          {canClose && (
            <Button variant="secondary" onClick={() => setConfirm('close')}>
              Close as missing
            </Button>
          )}
          {canCancel && !undoOpen && (
            <Button variant="secondary" onClick={() => setConfirm('cancel')}>
              Cancel transfer
            </Button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirm === 'close'}
        title="Close as missing?"
        message={`Whatever hasn't arrived at ${transfer.toBranchName} is marked missing. It stays in view at both branches until someone checks it.`}
        confirmLabel="Close as missing"
        loading={busy === 'close'}
        onConfirm={() => void act('close')}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'cancel'}
        title="Cancel this transfer?"
        message={`The stock goes back on ${transfer.fromBranchName}'s figures. Do this only if it never left.`}
        confirmLabel="Cancel transfer"
        loading={busy === 'cancel'}
        onConfirm={() => void act('cancel')}
        onCancel={() => setConfirm(null)}
      />
    </Page>
  )
}

function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">{children}</div>
}

/** The waybill's lines as they stand: sent, and what has happened to each since. */
function WaybillLines({ transfer }: { transfer: Transfer }) {
  const amount = useAmount()
  return (
    <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white" aria-label="On this waybill">
      {transfer.lines.map((line) => (
        <li key={line.productId} className="flex items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-base font-medium text-neutral-900">{line.productName}</p>
            <p className="text-xs text-neutral-500">{line.sku}</p>
          </div>
          <div className="shrink-0 text-right text-sm tabular-nums">
            <p className="text-neutral-900">Sent {sentText(line)}</p>
            {line.quantityReceived > 0 && <p className="text-neutral-600">Received {amount(line, line.quantityReceived)}</p>}
            {line.quantityMissing > 0 && <p className="text-warning-800">Missing {amount(line, line.quantityMissing)}</p>}
            {line.quantityDamaged > 0 && <p className="text-warning-800">Damaged {amount(line, line.quantityDamaged)}</p>}
            {transfer.status !== 'CANCELLED' && line.onTheWay > 0 && (
              <p className="text-neutral-600">{amount(line, line.onTheWay)} on the way</p>
            )}
          </div>
        </li>
      ))}
      <li className="hidden px-4 py-6 text-sm text-neutral-700 print:block">Received by: ____________________</li>
    </ul>
  )
}

/**
 * Receiving (UX §5.5). Every box opens at what is still on the way, so "Received as sent" is one tap.
 * A smaller number asks why - missing (the default), damaged, or still coming on a later trip; a
 * bigger one is "sent too many", which corrects the sending branch's books on the same receipt.
 */
function ReceiveForm({ transfer, onDone }: { transfer: Transfer; onDone: (next: Transfer) => void }) {
  const { showToast } = useToast()
  const amount = useAmount()
  const [entries, setEntries] = useState<Record<string, ReceiveEntry>>(() =>
    Object.fromEntries(transfer.lines.map((line) => [line.productId, { received: String(line.onTheWay), why: 'missing' as Shortfall }])),
  )
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const open = transfer.lines.filter((line) => line.onTheWay > 0)

  const rows = open.map((line) => {
    const entry = entries[line.productId]
    const typed = entry.received.trim()
    const received = typed === '' ? 0 : Number(typed)
    const valid = typed === '' || (Number.isInteger(received) && received >= 0)
    const short = Math.max(0, line.onTheWay - received)
    return { line, entry, received, valid, short, extra: Math.max(0, received - line.onTheWay) }
  })
  const asSent = rows.every((row) => row.valid && row.received === row.line.onTheWay)
  const totalOnTheWay = open.reduce((sum, line) => sum + line.onTheWay, 0)
  const totalReceived = rows.reduce((sum, row) => sum + row.received, 0)
  const valid = rows.every((row) => row.valid)

  async function receive() {
    if (!valid) return
    setSaving(true)
    setProblem(null)
    const payload = asSent
      ? { id: crypto.randomUUID(), asSent: true }
      : {
          id: crypto.randomUUID(),
          lines: rows.map((row) => ({
            productId: row.line.productId,
            received: row.received,
            missing: row.entry.why === 'missing' ? row.short : 0,
            damaged: row.entry.why === 'damaged' ? row.short : 0,
          })),
        }
    try {
      const outcome = await submitTransfer({
        kind: 'TRANSFER_RECEIVE',
        transferId: transfer.id,
        productIds: transfer.lines.map((line) => line.productId),
        summary: `${transfer.waybill} from ${transfer.fromBranchName}`,
        payload,
      })
      if (outcome.status === 'sent') {
        onDone(outcome.response)
        const lost = outcome.response.missing
        showToast(
          lost > 0
            ? `Received at ${transfer.toBranchName}. ${formatNumber(lost)} missing — ${transfer.fromBranchName} and the owner can see it.`
            : `Received at ${transfer.toBranchName}.`,
          lost > 0 ? 'info' : 'success',
        )
      } else {
        showToast('Received on this phone. It is sent when you are connected.', 'info')
      }
    } catch (err) {
      setProblem(isAppError(err) ? err.message : "Couldn't record this. Try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="receive-heading" className="flex flex-col gap-3">
      <h2 id="receive-heading" className="text-sm font-semibold text-neutral-900">
        What arrived
      </h2>
      <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
        {rows.map(({ line, entry, short, extra, valid: rowValid }) => {
          const inputId = `receive-${line.productId}`
          return (
            <li key={line.productId} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-medium text-neutral-900">{line.productName}</p>
                  <p className="text-xs tabular-nums text-neutral-500">
                    Sent {sentText(line)}
                    {line.onTheWay !== line.quantitySent && ` · ${amount(line, line.onTheWay)} still on the way`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor={inputId} className="text-sm text-neutral-600">
                    Received
                  </label>
                  <input
                    id={inputId}
                    inputMode="numeric"
                    value={entry.received}
                    disabled={saving}
                    aria-invalid={!rowValid || undefined}
                    onChange={(event) =>
                      setEntries((current) => ({
                        ...current,
                        [line.productId]: { ...entry, received: event.target.value.replace(/[^0-9]/g, '') },
                      }))
                    }
                    className="h-11 w-20 rounded-md border border-neutral-300 bg-white px-3 text-right text-base tabular-nums focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                  />
                </div>
              </div>
              {short > 0 && (
                <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <legend className="sr-only">Why {formatNumber(short)} short</legend>
                  <span className="text-neutral-700">{formatNumber(short)} short:</span>
                  {(
                    [
                      ['missing', 'Missing'],
                      ['damaged', 'Damaged'],
                      ['later', 'Still coming'],
                    ] as const
                  ).map(([value, label]) => (
                    <label key={value} className="inline-flex min-h-11 items-center gap-1.5">
                      <input
                        type="radio"
                        name={`why-${line.productId}`}
                        checked={entry.why === value}
                        onChange={() => setEntries((current) => ({ ...current, [line.productId]: { ...entry, why: value } }))}
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
              )}
              {extra > 0 && (
                <p className="text-sm text-neutral-700">
                  {formatNumber(extra)} more than sent: {transfer.fromBranchName}'s figure is corrected by the same receipt.
                </p>
              )}
            </li>
          )
        })}
      </ul>
      {problem && (
        <p role="alert" className="rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {problem}
        </p>
      )}
      <Button variant="action" className="w-full" disabled={!valid} loading={saving} onClick={() => void receive()}>
        {asSent ? 'Received as sent' : `Receive ${formatNumber(totalReceived)} of ${formatNumber(totalOnTheWay)}`}
      </Button>
    </section>
  )
}
