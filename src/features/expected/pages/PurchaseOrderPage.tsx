import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronLeft, Copy, FileDown, Pencil, Send, XCircle } from 'lucide-react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { api } from '@/api/client'
import { Button, buttonClassName } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { OverflowMenu, type OverflowMenuItem } from '@/components/OverflowMenu'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/components/useToast'
import { queryKeys } from '@/data/queryKeys'
import { useApiQuery } from '@/data/useApiQuery'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { expectedApi } from '@/features/expected/api/expectedApi'
import { ApprovalStep } from '@/features/expected/components/ApprovalStep'
import { CancelExpectedDialog } from '@/features/expected/components/CancelExpectedDialog'
import { InlineEmailEditor } from '@/features/expected/components/InlineEmailEditor'
import { StatusPill } from '@/features/expected/components/StatusPill'
import { statusOf } from '@/features/expected/orderStatus'
import { expectedCopy } from '@/features/expected/copy'
import { isRecent, looksLikePack, mayEditSupplier, neededWords, orderMoney, quantityWords, shortDate, whenText } from '@/features/expected/expected'
import type { ExpectedDelivery } from '@/features/expected/types'
import { copy } from '@/features/imports/copy'
import { quantityUnitWord } from '@/features/imports/delivery'
import { receiveCopy } from '@/features/imports/receiveCopy'
import { useEmailVerification } from '@/features/profile/hooks/useEmailVerification'
import { useResendVerification } from '@/features/profile/hooks/useResendVerification'
import { useVendorOptions } from '@/features/vendors/hooks/useVendorOptions'
import { isAppError } from '@/types/api'

const LIST_PATH = '/app/purchase-orders'
const text = expectedCopy.next

/** The PDF, opened from the order's own link so a plain click (never a blocked popup) gets the browser's viewer. */
function pdfHref(token: string): string {
  const base = String(api.defaults.baseURL ?? '').replace(/\/$/, '')
  return `${base}/api/public/purchase-orders/${token}/pdf`
}

type Channel = 'WHATSAPP' | 'EMAIL' | 'COPY'

/**
 * One purchase order (redesign 2026-11-04, owner-approved mockups D–F).
 *
 * The top always answers "what do I do now?" — one "Next step" box whose one navy button changes with
 * the order: Send → Receive → Receive the rest → Order again. The other ways to send sit under it as
 * quiet links. Below: the items with how much has arrived, then a short history that answers "did I
 * send it?" a week later. Change, Order again, the PDF and Call it off live in ⋯.
 *
 * Nothing is claimed that we can't know: email is "Sent by email" (the provider took it), WhatsApp is
 * only ever "You opened WhatsApp", never "delivered".
 */
export function PurchaseOrderPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const state = (location.state as { justCreated?: boolean; send?: string; changed?: boolean } | null) ?? {}
  const { user } = useAuth()
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const permissions = user?.type === 'tenant' ? user.permissions : []
  const canManage = permissions.includes(PERMISSIONS.MANAGE_INVENTORY)
  // V78: sending, changing a sent order and calling off are for whoever can send; asking is for anyone who can create.
  const canSend = permissions.includes(PERMISSIONS.SEND_PURCHASE_ORDER)
  const canCreate = canSend || permissions.includes(PERMISSIONS.CREATE_PURCHASE_ORDER)
  const canManageSuppliers = permissions.includes(PERMISSIONS.MANAGE_VENDORS)
  const canSeeSuppliers = permissions.includes(PERMISSIONS.VIEW_VENDORS)
  const { vendors, upsert: addVendor } = useVendorOptions(canSeeSuppliers)
  const branch = useOptionalWorkingBranch()
  const { emailVerified } = useEmailVerification()
  const confirmation = useResendVerification()

  const result = useApiQuery<ExpectedDelivery>({
    queryKey: queryKeys.expected.detail(id),
    queryFn: () => expectedApi.get(id),
    fallbackError: expectedCopy.page.loadFailed,
  })
  const order = result.data ?? null
  const { setData } = result

  const [sending, setSending] = useState(false)
  const [askAgain, setAskAgain] = useState(false)
  const [editingEmail, setEditingEmail] = useState(false)
  const [showWays, setShowWays] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [askClose, setAskClose] = useState(false)

  function adopt(updated: ExpectedDelivery) {
    setData(updated)
    void queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all })
    void queryClient.invalidateQueries({ queryKey: ['expected', 'list'] })
    void queryClient.invalidateQueries({ queryKey: ['expected', 'counts'] })
  }

  async function sendEmail() {
    if (!order) return
    setSending(true)
    setAskAgain(false)
    setActionError(null)
    try {
      adopt(await expectedApi.email(order.id))
    } catch (err: unknown) {
      setActionError(isAppError(err) ? err.message : expectedCopy.page.email.failed)
    } finally {
      setSending(false)
    }
  }

  async function record(channel: 'WHATSAPP' | 'MESSAGE') {
    if (!order) return
    try {
      adopt(await expectedApi.shared(order.id, channel))
    } catch {
      // Writing it down is a nicety: failing to must never get in the way of what they just did.
    }
  }

  async function copyMessage() {
    if (!order?.share?.message) return
    setCopyFailed(false)
    try {
      await navigator.clipboard.writeText(order.share.message)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
      void record('MESSAGE')
    } catch {
      setCopyFailed(true)
    }
  }

  async function handleCancel(short = false) {
    if (!order) return
    setCancelling(true)
    setCancelError(null)
    try {
      adopt(await expectedApi.cancel(order.id))
      showToast(short ? text.closedToast : expectedCopy.cancel.done, 'success')
      setAskClose(false)
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
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  if (!order) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <BackLink />
        <ErrorState title={expectedCopy.page.loadFailed} message={result.error ?? expectedCopy.page.notFound} onRetry={result.refetch} />
      </div>
    )
  }

  const isPo = order.poNumber != null
  const vendor = order.vendorId ? vendors.find((entry) => entry.id === order.vendorId) : undefined
  const supplier = order.vendorName ?? expectedCopy.page.theSupplier
  const share = order.share ?? null
  const address = (vendor?.email ?? '').trim() || (order.email?.toAddress ?? '')
  const canFixEmail = vendor != null && mayEditSupplier(vendor, canManageSuppliers)
  const latestEmail = order.email ?? null
  const emailProblem =
    latestEmail != null && latestEmail.status !== 'SENT' && order.waitingToBeSent && order.sentVia == null
  const someArrived = order.lines.some((line) => line.receivedQuantity > 0)
  // A priced order (plan section 11.4): every line has a price, so the table adds Amount and a total.
  const priced = order.lines.length > 0 && order.lines.every((line) => line.price != null)
  const columns = 2 + (someArrived ? 1 : 0) + (priced ? 1 : 0)
  const goingTo = branch?.isMultiBranch && order.branchId ? branch.nameOf(order.branchId) : undefined
  const status = statusOf(order)
  const held = order.approval?.status === 'WAITING' || order.approval?.status === 'CHANGE_ASKED'
  const isAsker = order.approval?.askedBy != null && order.approval.askedBy === user?.id

  // The way to offer first: what was picked on the form, else what has worked for this supplier.
  const preferred: Channel =
    state.send === 'EMAIL' && address
      ? 'EMAIL'
      : state.send === 'WHATSAPP' && share?.whatsappUrl
        ? 'WHATSAPP'
        : vendor?.emailOrders && address
          ? 'EMAIL'
          : share?.whatsappUrl
            ? 'WHATSAPP'
            : address
              ? 'EMAIL'
              : 'COPY'

  const meta = [
    order.expectedDate ? `${expectedCopy.form.neededBy} ${neededWords(order.expectedDate)}` : null,
    goingTo,
  ].filter(Boolean)

  // ---------------------------------------------------------------- ⋯ ---------------------------
  // Every item with its picture, as the app's other "⋯" menus (2026-11-10).
  const menuIcon = 'h-4 w-4 text-neutral-500'
  const menu: OverflowMenuItem[] = []
  if (share) menu.push({ label: text.menuPdf, icon: <FileDown className={menuIcon} aria-hidden="true" />, onSelect: () => window.open(pdfHref(share.token), '_blank', 'noopener') })
  if (canCreate && isPo && order.status === 'OPEN') {
    menu.push({ label: text.menuChange, icon: <Pencil className={menuIcon} aria-hidden="true" />, onSelect: () => navigate(`${LIST_PATH}/${order.id}/change`) })
  }
  if (canCreate && order.vendorId) menu.push({ label: text.menuAgain, icon: <Copy className={menuIcon} aria-hidden="true" />, onSelect: () => navigate(`${LIST_PATH}/new?again=${order.id}`) })
  if (canSend && isPo && order.status === 'OPEN' && !order.waitingToBeSent && !held) {
    menu.push({ label: text.menuSendAgain, icon: <Send className={menuIcon} aria-hidden="true" />, onSelect: () => setShowWays(true) })
  }
  if (order.status === 'OPEN' && (isPo ? canSend || (held && isAsker) : canManage)) {
    menu.push({ label: text.menuCallOff, tone: 'danger', icon: <XCircle className="h-4 w-4" aria-hidden="true" />, onSelect: () => setCancelOpen(true) })
  }

  // ---------------------------------------------------------------- the ways to send it ----------
  function wayButton(channel: Channel, main: boolean) {
    if (!order || !share) return null
    if (channel === 'WHATSAPP' && share.whatsappUrl) {
      return (
        <a
          key="wa"
          href={share.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => void record('WHATSAPP')}
          className={main ? buttonClassName('action', 'w-full') : linkClass}
        >
          {text.sendWhatsApp}
        </a>
      )
    }
    if (channel === 'EMAIL' && address) {
      const recently = latestEmail?.status === 'SENT' && isRecent(latestEmail.sentAt, 10)
      const onClick = () => (recently && !askAgain ? setAskAgain(true) : void sendEmail())
      return main ? (
        <Button key="em" variant="action" className="w-full" loading={sending} onClick={onClick}>
          {text.sendEmail(address)}
        </Button>
      ) : (
        <button key="em" type="button" className={linkClass} onClick={onClick} disabled={sending}>
          {sending ? expectedCopy.page.email.sending : text.sendEmail(address)}
        </button>
      )
    }
    if (channel === 'COPY') {
      return main ? (
        <Button key="cp" variant="action" className="w-full" disabled={!share.message} onClick={() => void copyMessage()}>
          {copied ? text.copied : text.copy}
        </Button>
      ) : (
        <button key="cp" type="button" className={linkClass} disabled={!share.message} onClick={() => void copyMessage()}>
          {copied ? text.copied : text.copy}
        </button>
      )
    }
    return null
  }

  function otherWays(except: Channel | null) {
    if (!share) return null
    const links = (['WHATSAPP', 'EMAIL', 'COPY'] as Channel[])
      .filter((channel) => channel !== except)
      .map((channel) => wayButton(channel, false))
      .filter(Boolean)
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-600">
        {except && <span>{text.or}</span>}
        {links}
        <a href={pdfHref(share.token)} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {text.pdf}
        </a>
      </div>
    )
  }

  // ---------------------------------------------------------------- next step -----------------
  let nextStep: React.ReactNode = null
  const receiveHref = `/app/products/receive?expected=${order.id}`
  if (order.status === 'CANCELLED') {
    nextStep = (
      <NextBox say={someArrived ? text.closedShort('') : text.calledOff} note={someArrived ? text.closedShortNote : text.calledOffNote}>
        {canManage && order.vendorId && (
          <Link to={`${LIST_PATH}/new?again=${order.id}`} className={buttonClassName('secondary', 'w-full')}>
            {text.orderAgain}
          </Link>
        )}
      </NextBox>
    )
  } else if (order.status === 'RECEIVED') {
    const last = order.receipts && order.receipts.length > 0 ? order.receipts[order.receipts.length - 1] : null
    nextStep = (
      <NextBox say={text.allArrived(last ? shortDate(last.receivedAt.slice(0, 10)) : '')}>
        {canManage && order.vendorId && (
          <Link to={`${LIST_PATH}/new?again=${order.id}`} className={buttonClassName('action', 'w-full')}>
            {text.orderAgain}
          </Link>
        )}
        <div className="text-sm">
          <Link to="/app/purchases" className={linkClass}>
            {text.seeDeliveries}
          </Link>
        </div>
      </NextBox>
    )
  } else if (isPo && held) {
    nextStep = (
      <ApprovalStep
        order={order}
        supplier={supplier}
        canSend={canSend}
        isAsker={isAsker}
        changeHref={`${LIST_PATH}/${order.id}/change`}
        onUpdated={adopt}
      />
    )
  } else if (isPo && order.waitingToBeSent && canSend && !someArrived) {
    // Two different email troubles, said differently (2026-11-05): the supplier's address bounced
    // (fix the address), or our side refused to send (your own email isn't confirmed, a daily cap) -
    // never "didn't reach tony@" when Tony's address was never tried.
    const bounced = emailProblem && (latestEmail?.status === 'BOUNCED' || latestEmail?.status === 'COMPLAINED')
    const refused = emailProblem && !bounced
    const say = bounced
      ? text.emailProblem(latestEmail?.toAddress ?? address)
      : refused
        ? text.emailNotSent(supplier)
        : state.justCreated
          ? text.made(order.poNumber ?? '', supplier)
          : (order.revision ?? 1) > 1 && order.sentVia != null
            ? text.changed(supplier)
            : order.approval?.status === 'APPROVED'
              ? text.approvedSend(supplier)
              : text.notSent(supplier)
    const note = bounced ? text.emailProblemNote : refused ? (latestEmail?.problem ?? undefined) : undefined
    // After a failed email, offer another way first - the order still has to reach the supplier today.
    const otherThanEmail: Channel = share?.whatsappUrl ? 'WHATSAPP' : 'COPY'
    const mainWay: Channel = bounced || (refused && !emailVerified) ? otherThanEmail : preferred
    const fixFirst = bounced && canFixEmail
    nextStep = (
      <NextBox say={say} tick={state.justCreated && !emailProblem} note={note}>
        {fixFirst && !editingEmail && (
          <Button variant="action" className="w-full" onClick={() => setEditingEmail(true)}>
            {text.fixEmail}
          </Button>
        )}
        {editingEmail && vendor && (
          <InlineEmailEditor
            vendor={vendor}
            onSaved={(updated) => {
              addVendor(updated)
              setEditingEmail(false)
            }}
            onCancel={() => setEditingEmail(false)}
          />
        )}
        {!fixFirst && wayButton(mainWay, true)}
        {askAgain && <AskAgain onYes={() => void sendEmail()} onNo={() => setAskAgain(false)} />}
        {otherWays(fixFirst ? null : mainWay)}
        {refused && !emailVerified && (
          <div className="text-sm">
            <button
              type="button"
              className={linkClass}
              disabled={confirmation.sending || confirmation.throttled}
              onClick={() => void confirmation.resend()}
            >
              {expectedCopy.page.email.confirmMine}
            </button>
            {confirmation.feedback && <p role="status" className="mt-1 text-neutral-600">{confirmation.feedback.message}</p>}
          </div>
        )}
        {/* The supplier can turn up before anybody marked it sent: receiving is never locked away. */}
        {order.receivable && (
          <div className="border-t border-neutral-100 pt-2 text-sm">
            <Link to={receiveHref} className={linkClass}>
              {text.receiveEarly}
            </Link>
          </div>
        )}
      </NextBox>
    )
  } else if (order.receivable) {
    const owed = order.lines.filter((line) => line.outstanding > 0)
    const say = someArrived
      ? owed.length === 1
        ? text.stillToCome(`${quantityWords(owed[0].outstanding, owed[0].comesIn).replace(/ \(.*\)$/, '')} of ${owed[0].productName.toLowerCase()}`)
        : text.itemsToCome(owed.length)
      : !isPo
        ? text.writtenDown(supplier)
        : order.sentVia === 'PHONE'
          ? text.byPhone(order.sentAt ? whenText(order.sentAt) : '')
          : (order.sentVia === 'WHATSAPP' ? text.sentWhatsApp : order.sentVia === 'MESSAGE' ? text.sentMessage : text.sentEmail)(
              supplier,
              order.sentAt ? whenText(order.sentAt) : '',
            )
    nextStep = (
      <NextBox say={say} note={!someArrived && order.sentVia === 'PHONE' ? text.byPhoneNote(supplier) : undefined}>
        {canManage && (
          <Link to={receiveHref} className={buttonClassName('action', 'w-full')}>
            {someArrived ? text.receiveRest : text.receive}
          </Link>
        )}
        {/* Came short and the rest won't follow: close it in place, keeping what arrived. */}
        {canManage && someArrived && !askClose && (
          <div className="text-sm">
            <button type="button" className={linkClass} onClick={() => setAskClose(true)}>
              {text.restNotComing}
            </button>
          </div>
        )}
        {canManage && someArrived && askClose && (
          <div className="flex flex-col gap-2 rounded-md bg-neutral-50 p-3 text-sm text-neutral-800">
            <p>
              {text.closeAsk(
                order.poNumber ?? order.title,
                owed.length === 1
                  ? quantityWords(owed[0].outstanding, owed[0].comesIn).replace(/ \(.*\)$/, '') + ' of ' + owed[0].productName.toLowerCase()
                  : text.itemsToCome(owed.length).replace(' still to come', ''),
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" loading={cancelling} onClick={() => void handleCancel(true)}>
                {text.closeYes}
              </Button>
              <Button variant="quiet" onClick={() => setAskClose(false)}>
                {text.closeNo}
              </Button>
            </div>
            {cancelError && <p role="alert" className="text-danger-700">{cancelError}</p>}
          </div>
        )}
        {canSend && isPo && !showWays && (
          <div className="text-sm">
            <button type="button" className={linkClass} onClick={() => setShowWays(true)}>
              {order.sentVia === 'PHONE' ? text.sendAfterAll(supplier) : text.sendAgain}
            </button>
          </div>
        )}
        {showWays && (
          <>
            {askAgain && <AskAgain onYes={() => void sendEmail()} onNo={() => setAskAgain(false)} />}
            {otherWays(null)}
          </>
        )}
      </NextBox>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <BackLink />
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
              {isPo ? expectedCopy.page.poLabel(order.poNumber ?? '') : expectedCopy.rows.writtenDown}
              <StatusPill status={status} />
              {(order.revision ?? 1) > 1 && <span className="text-xs text-neutral-500">{expectedCopy.page.revised(order.revision ?? 1)}</span>}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-neutral-900">{order.vendorName ?? order.title}</h1>
            {meta.length > 0 && <p className="mt-1 text-sm text-neutral-600">{meta.join(' · ')}</p>}
          </div>
          {menu.length > 0 && <OverflowMenu items={menu} label={text.menuLabel(order.poNumber ?? order.title)} />}
        </div>
      </div>

      {nextStep}
      {actionError && (
        <p role="alert" className="-mt-3 text-sm text-danger-700">
          {actionError}
        </p>
      )}
      {copyFailed && share?.message && (
        <div className="-mt-3 flex flex-col gap-1">
          <p role="alert" className="text-sm text-danger-700">
            {expectedCopy.page.message.copyFailed}
          </p>
          <textarea
            readOnly
            rows={6}
            value={share.message}
            onFocus={(event) => event.currentTarget.select()}
            aria-label={expectedCopy.page.message.label}
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-800"
          />
        </div>
      )}

      {/* ------------------------------------------------------------------- items ---------- */}
      <section aria-labelledby="po-items-heading" className="flex flex-col gap-2">
        <h2 id="po-items-heading" className="text-sm font-semibold text-neutral-900">
          {text.itemsHeading}
        </h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                <th scope="col" className="px-4 py-2 font-medium">{text.product}</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">{text.ordered}</th>
                {someArrived && <th scope="col" className="px-4 py-2 text-right font-medium">{text.arrived}</th>}
                {priced && <th scope="col" className="px-4 py-2 text-right font-medium">{text.amount}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {order.lines.map((line) => {
                const done = line.receivedQuantity >= line.quantity
                return (
                  <tr key={line.id}>
                    <td className="px-4 py-2.5 font-medium text-neutral-900">
                      {line.productName}
                      {priced && line.price != null && (
                        <span className="block text-xs font-normal text-neutral-600">
                          {text.pricePer(orderMoney(line.price), quantityUnitWord({ comesIn: line.comesIn, pack: looksLikePack(line.comesIn) }, 1))}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums text-neutral-800">
                      {quantityWords(line.quantity, line.comesIn)}
                    </td>
                    {someArrived && (
                      <td className={`px-4 py-2.5 text-right whitespace-nowrap tabular-nums ${done ? 'text-accent-700' : 'text-neutral-800'}`}>
                        {line.receivedQuantity > 0 ? line.receivedQuantity : '—'}
                        {done && <Check className="ml-1 inline h-4 w-4" aria-label="all arrived" />}
                      </td>
                    )}
                    {priced && (
                      <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums text-neutral-900">
                        {line.price != null ? orderMoney(Math.round(line.price * line.quantity * 100) / 100) : '—'}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            {priced && (
              <tfoot className="border-t border-neutral-200">
                {order.deliveryCharge != null && (
                  <tr>
                    <th scope="row" colSpan={columns - 1} className="px-4 pt-2.5 pb-1 text-left font-normal text-neutral-600">
                      {text.deliveryRow}
                    </th>
                    <td className="px-4 pt-2.5 pb-1 text-right tabular-nums text-neutral-900">
                      {order.deliveryCharge === 0 ? text.deliveryFree : orderMoney(order.deliveryCharge)}
                    </td>
                  </tr>
                )}
                <tr>
                  <th scope="row" colSpan={columns - 1} className="px-4 pt-1.5 pb-3 text-left font-semibold text-neutral-900">
                    {text.totalRow}
                  </th>
                  <td className="px-4 pt-1.5 pb-3 text-right text-base font-semibold tabular-nums text-neutral-900">
                    {orderMoney(order.total ?? 0)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {!priced && order.poNumber != null && <p className="text-xs text-neutral-500">{text.noPrices}</p>}
        {order.note != null && (
          <p className="text-sm text-neutral-700">
            <span className="text-neutral-500">{text.noteHeading(supplier)}: </span>
            {order.note}
          </p>
        )}
      </section>

      {/* ----------------------------------------------------------------- history ---------- */}
      <History order={order} supplier={supplier} />

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

const linkClass =
  'rounded-sm font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none disabled:text-neutral-400'

function BackLink() {
  return (
    <Link
      to={LIST_PATH}
      className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
    >
      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      {expectedCopy.page.back}
    </Link>
  )
}

/** The "Next step" box: what is true now in one sentence, then the one thing to press. */
function NextBox({ say, note, tick, children }: { say: string; note?: string; tick?: boolean; children?: React.ReactNode }) {
  return (
    <section aria-label={say} className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
      <div>
        <p className="flex items-start gap-2 text-base font-semibold text-neutral-900">
          {tick && <Check className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" aria-hidden="true" />}
          {say}
        </p>
        {note && <p className="mt-1 text-sm text-neutral-600">{note}</p>}
      </div>
      {children}
    </section>
  )
}

function AskAgain({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-700">
      <span>{text.sentAgainAsk}</span>
      <Button variant="secondary" onClick={onYes}>
        {text.sentAgainYes}
      </Button>
      <Button variant="quiet" onClick={onNo}>
        {text.sentAgainNo}
      </Button>
    </div>
  )
}

/** What happened to this order, newest first — built from what is already stored on it. */
function History({ order, supplier }: { order: ExpectedDelivery; supplier: string }) {
  const events: { at: string; text: React.ReactNode; good?: boolean }[] = []
  const approval = order.approval
  // Made and sent for approval in one go is one line, not two.
  const madeForApproval =
    approval?.askedAt != null && Math.abs(new Date(approval.askedAt).getTime() - new Date(order.createdAt).getTime()) < 60_000
  if (!madeForApproval) {
    events.push({ at: order.createdAt, text: order.createdByName ? text.madeBy(order.createdByName) : text.madeAnon })
  }
  if (order.email) {
    events.push({
      at: order.email.sentAt,
      text: order.email.status === 'SENT' ? text.emailed(order.email.toAddress ?? '') : text.emailFailed(order.email.toAddress ?? ''),
    })
  }
  if (order.share?.whatsappOpenedAt) events.push({ at: order.share.whatsappOpenedAt, text: text.whatsappOpened(supplier) })
  if (order.share?.messageCopiedAt) events.push({ at: order.share.messageCopiedAt, text: text.messageCopied })
  if (order.sentVia === 'PHONE' && order.sentAt) events.push({ at: order.sentAt, text: text.orderedByPhone })
  if (approval?.askedAt) events.push({ at: approval.askedAt, text: text.sentForApproval(approval.askedByName ?? '') })
  if (approval?.changeAskedAt) {
    events.push({ at: approval.changeAskedAt, text: text.changeAskedBy(approval.changeAskedByName ?? '', approval.changeNote ?? '') })
  }
  if (approval?.approvedAt) events.push({ at: approval.approvedAt, good: true, text: text.approvedBy(approval.approvedByName ?? '') })
  for (const receipt of order.receipts ?? []) {
    events.push({
      at: receipt.receivedAt,
      good: true,
      text: (
        <>
          {text.received(receipt.receivedByName ?? null, receipt.lineCount)}{' '}
          <Link to={`/app/products/import/${receipt.importId}/result`} className={linkClass}>
            {text.seeDelivery}
          </Link>
          {(receipt.sentBack ?? []).map((back, index) => (
            <span key={index} className="block text-neutral-600">
              {text.sentBack(
                `${quantityWords(back.quantity, back.comesIn).replace(/ \(.*\)$/, '')} of ${back.productName.toLowerCase()}`,
                back.reason === 'OTHER' && back.note ? back.note : receiveCopy.reasons[back.reason],
              )}
            </span>
          ))}
        </>
      ),
    })
  }
  events.sort((a, b) => b.at.localeCompare(a.at))

  return (
    <section aria-labelledby="po-history-heading" className="flex flex-col gap-2">
      <h2 id="po-history-heading" className="text-sm font-semibold text-neutral-900">
        {text.historyHeading}
      </h2>
      <ul className="flex flex-col gap-2">
        {events.map((event, index) => (
          <li key={index} className="grid grid-cols-[0.75rem_1fr] gap-2 text-sm text-neutral-700">
            <span className={`mt-1.5 h-2 w-2 rounded-full ${event.good ? 'bg-accent-600' : 'bg-neutral-400'}`} aria-hidden="true" />
            <span>
              {event.text} <span className="text-neutral-500">· {whenText(event.at)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
