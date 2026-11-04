import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronLeft, Truck } from 'lucide-react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { Badge } from '@/components/Badge'
import { Button, buttonClassName } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/components/useToast'
import { api } from '@/api/client'
import { queryKeys } from '@/data/queryKeys'
import { useApiQuery } from '@/data/useApiQuery'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { expectedApi } from '@/features/expected/api/expectedApi'
import { CancelExpectedDialog } from '@/features/expected/components/CancelExpectedDialog'
import { InlineEmailEditor } from '@/features/expected/components/InlineEmailEditor'
import { expectedCopy } from '@/features/expected/copy'
import { isOverdue, isRecent, shortDate, whenText } from '@/features/expected/expected'
import type { ExpectedDelivery } from '@/features/expected/types'
import { copy } from '@/features/imports/copy'
import { useEmailVerification } from '@/features/profile/hooks/useEmailVerification'
import { useResendVerification } from '@/features/profile/hooks/useResendVerification'
import { useVendorOptions } from '@/features/vendors/hooks/useVendorOptions'
import { isAppError } from '@/types/api'

const LIST_PATH = '/app/purchase-orders'
const copyText = expectedCopy.page

/** The PDF, opened from the order's own link so a plain click (never a blocked popup) gets the browser's viewer. */
function pdfHref(token: string): string {
  const base = String(api.defaults.baseURL ?? '').replace(/\/$/, '')
  return `${base}/api/public/purchase-orders/${token}/pdf`
}

/**
 * One purchase order — where you land right after making it, and where "did I send it?" is answered
 * a week later (`PURCHASE_ORDER_PLAN.md` §3.3, §3.4).
 *
 * The part that must not confuse is "Send it to Tony": one line per way of getting it to them, each
 * with a plain status and at most one thing to press. Nothing is claimed that we cannot know — email
 * is "Emailed" (the provider took it), WhatsApp is only ever "you opened it", never "delivered".
 * A way that cannot work for this supplier (no phone, no email) says so, or is left out; it is never
 * a disabled button with a riddle on it.
 */
export function PurchaseOrderPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const justCreated = (location.state as { justCreated?: boolean } | null)?.justCreated === true
  const { user } = useAuth()
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const permissions = user?.type === 'tenant' ? user.permissions : []
  const canManage = permissions.includes(PERMISSIONS.MANAGE_INVENTORY)
  const canManageSuppliers = permissions.includes(PERMISSIONS.MANAGE_VENDORS)
  const canSeeSuppliers = permissions.includes(PERMISSIONS.VIEW_VENDORS)
  const { vendors, upsert: addVendor } = useVendorOptions(canSeeSuppliers)
  const branch = useOptionalWorkingBranch()
  const { emailVerified } = useEmailVerification()
  const confirmation = useResendVerification()

  const result = useApiQuery<ExpectedDelivery>({
    queryKey: queryKeys.expected.detail(id),
    queryFn: () => expectedApi.get(id),
    fallbackError: copyText.loadFailed,
  })
  const order = result.data ?? null
  const { setData } = result

  const [sending, setSending] = useState(false)
  const [askAgain, setAskAgain] = useState(false)
  const [editingEmail, setEditingEmail] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const vendor = order?.vendorId ? vendors.find((entry) => entry.id === order.vendorId) : undefined
  const supplier = order?.vendorName ?? 'the supplier'

  /** Replace what is on screen with what the server just said, and tell the rest of the app. */
  function adopt(updated: ExpectedDelivery) {
    setData(updated)
    void queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all })
    void queryClient.invalidateQueries({ queryKey: ['expected', 'list'] })
  }

  async function sendEmail() {
    if (!order) return
    setSending(true)
    setAskAgain(false)
    setActionError(null)
    try {
      adopt(await expectedApi.email(order.id))
    } catch (err: unknown) {
      setActionError(isAppError(err) ? err.message : copyText.email.failed)
    } finally {
      setSending(false)
    }
  }

  async function record(channel: 'WHATSAPP' | 'MESSAGE') {
    if (!order) return
    try {
      setData(await expectedApi.shared(order.id, channel))
    } catch {
      // Writing it down is a nicety: failing to must never get in the way of the thing they just did.
    }
  }

  async function copyMessage() {
    if (!order?.share?.message) return
    setCopyFailed(false)
    try {
      await navigator.clipboard.writeText(order.share.message)
      void record('MESSAGE')
    } catch {
      setCopyFailed(true)
    }
  }

  async function handleCancel() {
    if (!order) return
    setCancelling(true)
    setCancelError(null)
    try {
      adopt(await expectedApi.cancel(order.id))
      showToast(expectedCopy.cancel.done, 'success')
      setCancelOpen(false)
    } catch (err: unknown) {
      setCancelError(isAppError(err) ? err.message : expectedCopy.cancel.failed)
    } finally {
      setCancelling(false)
    }
  }

  if (result.loading && !order) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4" role="status" aria-busy="true" aria-label={copy.common.loading}>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  if (!order) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <BackLink />
        <ErrorState title={copyText.loadFailed} message={result.error ?? copyText.notFound} onRetry={result.refetch} />
      </div>
    )
  }

  const isPo = order.poNumber != null
  const calledOff = order.status === 'CANCELLED'
  const share = order.share ?? null
  const overdue = isOverdue(order)
  const goingTo =
    branch?.isMultiBranch && order.branchId ? branch.nameOf(order.branchId) : undefined
  const address = (vendor?.email ?? '').trim() || (order.email?.toAddress ?? '')
  const hasPhoneRoute = share?.whatsappUrl != null
  const nothingToSendWith = isPo && !calledOff && address === '' && !hasPhoneRoute

  const subtitle = [
    order.vendorName,
    order.expectedDate ? copyText.needed(shortDate(order.expectedDate)) : null,
    goingTo ? copyText.deliverTo(goingTo) : null,
  ].filter(Boolean)

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <BackLink />
        <div className="mt-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            {isPo && justCreated && !calledOff ? (
              <>
                <h1 className="flex items-center gap-2 text-2xl font-semibold text-neutral-900">
                  <Check className="h-6 w-6 shrink-0 text-accent-600" aria-hidden="true" />
                  {copyText.ready(order.poNumber ?? '')}
                </h1>
                <p className="mt-1 text-sm text-neutral-600">{copyText.readySub}</p>
              </>
            ) : (
              <h1 className="text-2xl font-semibold text-neutral-900">{isPo ? order.poNumber : order.title}</h1>
            )}
            {subtitle.length > 0 && <p className="mt-1 text-sm text-neutral-600">{subtitle.join(' · ')}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(order.revision ?? 1) > 1 && <Badge variant="info">{copyText.revised(order.revision ?? 1)}</Badge>}
            {overdue && <Badge variant="warning">{expectedCopy.list.overdue}</Badge>}
            {order.status === 'RECEIVED' && <Badge variant="success">{expectedCopy.list.statusReceived}</Badge>}
            {calledOff && <Badge variant="neutral">{copyText.calledOff}</Badge>}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ send it ---------- */}
      {isPo && (
        <section aria-labelledby="po-send-heading" className="flex flex-col gap-1">
          <h2 id="po-send-heading" className="text-sm font-semibold text-neutral-900">
            {copyText.sendHeading(supplier)}
          </h2>
          {calledOff ? (
            <p className="text-sm text-neutral-600">{copyText.calledOffNote}</p>
          ) : (
            <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
              {/* Email ------------------------------------------------------------------- */}
              <Channel label={copyText.email.label} channel="email">
                {editingEmail && vendor ? (
                  <InlineEmailEditor
                    vendor={vendor}
                    onSaved={(updated) => {
                      addVendor(updated)
                      setEditingEmail(false)
                    }}
                    onCancel={() => setEditingEmail(false)}
                  />
                ) : (
                  <EmailStatus
                    order={order}
                    supplier={supplier}
                    address={address}
                    sending={sending}
                    askAgain={askAgain}
                    canManage={canManage}
                    canEditAddress={canManageSuppliers && vendor != null && vendor.kind !== 'VERIFIED' && vendor.editable !== false}
                    emailVerified={emailVerified}
                    confirmation={confirmation}
                    onSend={() => void sendEmail()}
                    onAskAgain={() => setAskAgain(true)}
                    onCancelAsk={() => setAskAgain(false)}
                    onEditAddress={() => setEditingEmail(true)}
                  />
                )}
                {actionError && (
                  <p role="alert" className="mt-1.5 text-sm text-danger-700">
                    {actionError}
                  </p>
                )}
              </Channel>

              {/* WhatsApp: only when there is a number it can use — never a disabled button. */}
              {share?.whatsappUrl && (
                <Channel label={copyText.whatsapp.label} channel="whatsapp">
                  {share.whatsappOpenedAt && (
                    <p className="pt-2 text-sm text-neutral-700">
                      {copyText.whatsapp.openedAt(whenText(share.whatsappOpenedAt))}
                    </p>
                  )}
                  {canManage && (
                    <div className={share.whatsappOpenedAt ? 'mt-2' : ''}>
                      <a
                        href={share.whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => void record('WHATSAPP')}
                        className={buttonClassName(share.whatsappOpenedAt ? 'quiet' : 'secondary')}
                      >
                        {share.whatsappOpenedAt ? copyText.whatsapp.again : copyText.whatsapp.send}
                      </a>
                    </div>
                  )}
                </Channel>
              )}

              {/* The message, for anyone who would rather paste it into their own app. */}
              {share && (
                <Channel label={copyText.message.label} channel="message">
                  {share.messageCopiedAt && (
                    <p className="pt-2 text-sm text-neutral-700">
                      {copyText.message.copiedAt(whenText(share.messageCopiedAt))}
                    </p>
                  )}
                  <div className={share.messageCopiedAt ? 'mt-2' : ''}>
                    <Button
                      variant={share.messageCopiedAt ? 'quiet' : 'secondary'}
                      disabled={!share.message}
                      onClick={() => void copyMessage()}
                    >
                      {share.messageCopiedAt ? copyText.message.again : copyText.message.copy}
                    </Button>
                  </div>
                  {copyFailed && (
                    <div className="mt-2 flex flex-col gap-1">
                      <p role="alert" className="text-sm text-danger-700">
                        {copyText.message.copyFailed}
                      </p>
                      <textarea
                        readOnly
                        rows={6}
                        value={share.message ?? ''}
                        onFocus={(event) => event.currentTarget.select()}
                        aria-label={copyText.message.label}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-800"
                      />
                    </div>
                  )}
                </Channel>
              )}

              {/* The PDF — the browser's own viewer, with print and download in its toolbar. */}
              {share && (
                <Channel label={copyText.pdf.label} channel="pdf">
                  <div>
                    <a
                      href={pdfHref(share.token)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonClassName('secondary')}
                    >
                      {copyText.pdf.open}
                    </a>
                  </div>
                </Channel>
              )}
            </ul>
          )}
          {nothingToSendWith && <p className="mt-1 text-sm text-neutral-600">{copyText.nothingToSendWith(supplier)}</p>}
        </section>
      )}

      {/* --------------------------------------------------------------- what was asked ------- */}
      <section aria-labelledby="po-items-heading" className="flex flex-col gap-1">
        <h2 id="po-items-heading" className="text-sm font-semibold text-neutral-900">
          {copyText.itemsHeading}
        </h2>
        <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
          {order.lines.map((line) => (
            <li key={line.id} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="font-medium text-neutral-900">{line.productName}</span>
                {line.receivedQuantity > 0 && (
                  <span className="mt-0.5 block text-xs text-neutral-500">
                    {line.receivedQuantity} of {line.quantity} arrived
                  </span>
                )}
              </span>
              <span className="shrink-0 tabular-nums text-neutral-700">
                {line.quantity} × {line.comesIn}
              </span>
            </li>
          ))}
        </ul>
        {order.note != null && <p className="mt-1 text-sm text-neutral-600">{order.note}</p>}
      </section>

      {/* ---------------------------------------------------------------------- actions ------- */}
      {(order.receivable || order.status === 'OPEN') && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {order.receivable && (
              <Link
                to={`/app/products/receive?expected=${order.id}`}
                aria-label={expectedCopy.list.receiveLabel(order.title)}
                className={buttonClassName('action', 'w-full sm:w-auto')}
              >
                <Truck className="h-4 w-4" aria-hidden="true" />
                {expectedCopy.list.receive}
              </Link>
            )}
            {canManage && order.status === 'OPEN' && (
              <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setCancelOpen(true)}>
                {expectedCopy.list.cancel}
              </Button>
            )}
          </div>
          {isPo && order.receivable && <p className="text-sm text-neutral-600">{copyText.receiveHint}</p>}
        </div>
      )}

      <CancelExpectedDialog
        expected={cancelOpen ? order : null}
        cancelling={cancelling}
        error={cancelError}
        onConfirm={() => void handleCancel()}
        onClose={() => {
          if (!cancelling) setCancelOpen(false)
        }}
      />
    </div>
  )
}

function BackLink() {
  return (
    <Link
      to={LIST_PATH}
      className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
    >
      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      {copyText.back}
    </Link>
  )
}

/** One way of getting it to the supplier: its name on the left, its status and its one action beside it. */
function Channel({ label, channel, children }: { label: string; channel: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[5.5rem_1fr] items-start gap-x-3 py-3" data-channel={channel}>
      <span className="pt-2 text-sm text-neutral-500">{label}</span>
      <div className="min-w-0">{children}</div>
    </li>
  )
}

interface EmailStatusProps {
  order: ExpectedDelivery
  supplier: string
  address: string
  sending: boolean
  askAgain: boolean
  canManage: boolean
  canEditAddress: boolean
  emailVerified: boolean
  confirmation: ReturnType<typeof useResendVerification>
  onSend: () => void
  onAskAgain: () => void
  onCancelAsk: () => void
  onEditAddress: () => void
}

/**
 * The email line, in every state it can be in. The wording of a problem comes from the server as a
 * sentence and is shown as it is; what this decides is the one thing to press next.
 */
function EmailStatus(props: EmailStatusProps) {
  const { order, supplier, address, sending, askAgain, canManage, canEditAddress, emailVerified, confirmation } = props
  const text = copyText.email
  const latest = order.email ?? null
  // The address was corrected after the attempt: what is on screen is about the old one.
  const addressChanged = latest != null && latest.toAddress != null && address !== '' && latest.toAddress.toLowerCase() !== address.toLowerCase()

  const line = (children: React.ReactNode) => <p className="pt-2 text-sm text-neutral-700">{children}</p>
  const actions = (children: React.ReactNode) => <div className="mt-2 flex flex-wrap items-center gap-2">{children}</div>

  if (sending) {
    return line(text.sending)
  }

  // Nothing tried yet, or the address changed since the last attempt.
  if (latest == null || addressChanged) {
    if (address === '') {
      return (
        <>
          {line(text.noAddress(supplier))}
          {canEditAddress && canManage && actions(<Button variant="secondary" onClick={props.onEditAddress}>{text.add}</Button>)}
        </>
      )
    }
    return (
      <>
        {line(text.notSent)}
        {canManage && actions(<Button variant="secondary" onClick={props.onSend}>{text.send(address)}</Button>)}
      </>
    )
  }

  if (latest.status === 'SENT') {
    return (
      <>
        {line(text.sentTo(latest.toAddress ?? address, whenText(latest.sentAt)))}
        {canManage &&
          (askAgain ? (
            <div className="mt-2 flex flex-col gap-2">
              <p className="text-sm text-neutral-700">{text.sendAgainAsk}</p>
              {actions(
                <>
                  <Button variant="secondary" onClick={props.onSend}>{text.sendAgainYes}</Button>
                  <Button variant="quiet" onClick={props.onCancelAsk}>{text.sendAgainNo}</Button>
                </>,
              )}
            </div>
          ) : (
            actions(
              <Button variant="quiet" onClick={isRecent(latest.sentAt, 10) ? props.onAskAgain : props.onSend}>
                {text.sendAgain}
              </Button>,
            )
          ))}
      </>
    )
  }

  if (latest.status === 'BOUNCED') {
    return (
      <>
        {line(latest.problem ?? text.failed)}
        {canManage && canEditAddress && actions(<Button variant="secondary" onClick={props.onEditAddress}>{text.fix}</Button>)}
      </>
    )
  }

  if (latest.status === 'COMPLAINED') {
    return line(latest.problem ?? text.failed)
  }

  // FAILED: the server's sentence, and the one thing that fixes it.
  return (
    <>
      {line(latest.problem ?? text.failed)}
      {canManage &&
        actions(
          !emailVerified ? (
            <>
              <Button variant="secondary" loading={confirmation.sending} disabled={confirmation.throttled} onClick={() => void confirmation.resend()}>
                {text.confirmMine}
              </Button>
              {address !== '' && (
                <Button variant="quiet" onClick={props.onSend}>
                  {text.tryAgain}
                </Button>
              )}
            </>
          ) : address === '' ? (
            canEditAddress ? <Button variant="secondary" onClick={props.onEditAddress}>{text.add}</Button> : null
          ) : (
            <Button variant="secondary" onClick={props.onSend}>{text.tryAgain}</Button>
          ),
        )}
      {confirmation.feedback && (
        <p className="mt-1.5 text-sm text-neutral-600" role="status">
          {confirmation.feedback.message}
        </p>
      )}
    </>
  )
}
