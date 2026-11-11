import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Truck } from 'lucide-react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { Badge, type BadgeVariant } from '@/components/Badge'
import { buttonClassName } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { useWorkingBranch } from '@/features/branches/useWorkingBranch'
import { formatDateTime } from '@/features/products/formatters'
import { formatNumber } from '@/features/products/unitCopy'
import { STATUS_LABEL, type Transfer, type TransferStatus } from '@/features/transfers/types'
import { usePendingTransfers, useTransfers } from '@/features/transfers/useTransfers'

const STATUS_VARIANT: Record<TransferStatus, BadgeVariant> = {
  ON_THE_WAY: 'info',
  PARTLY_RECEIVED: 'info',
  RECEIVED: 'success',
  RECEIVED_SHORT: 'warning',
  CANCELLED: 'neutral',
}

/**
 * Transfers (MULTI_BRANCH_UX_PLAN.md §5.4-5.5, §6): what is on the way to and from the branch this
 * phone is at - or every branch the person sees, in "All branches" - and what was sent and received.
 * Waybills made on this phone and not yet sent are at the top, stamped RECORDED.
 */
export function TransfersPage() {
  const { user } = useAuth()
  const permissions = user?.type === 'tenant' ? user.permissions : []
  const canSend = permissions.includes(PERMISSIONS.SEND_STOCK)
  const { working, isAll } = useWorkingBranch()
  // ?tab=all from the owner's branch table ("Missing"), else what is on the way.
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<'open' | 'all'>(searchParams.get('tab') === 'all' ? 'all' : 'open')
  const branchId = isAll ? undefined : working?.id
  const list = useTransfers({ branchId, openOnly: tab === 'open' })
  const recent = useTransfers({ branchId }, tab === 'open')
  const pendingSends = usePendingTransfers().filter((op) => op.kind === 'TRANSFER_SEND')
  const transfers = list.data?.content ?? []
  const lastReceived = (recent.data?.content ?? []).filter((t) => t.status === 'RECEIVED' || t.status === 'RECEIVED_SHORT').slice(0, 5)
  const neverAny = tab === 'open' && transfers.length === 0 && (recent.data?.content.length ?? 0) === 0 && pendingSends.length === 0

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Transfers</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Stock sent between {isAll ? 'your branches' : `${working?.name ?? 'this branch'} and your other branches`}.
          </p>
        </div>
        {canSend && (
          <Link to="/app/transfers/send" className={buttonClassName('action')}>
            <Truck className="h-4 w-4" aria-hidden="true" />
            Send stock
          </Link>
        )}
      </div>

      <div role="tablist" aria-label="Transfers" className="flex gap-1 border-b border-neutral-200">
        {(
          [
            ['open', 'On the way'],
            ['all', 'All'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`-mb-px min-h-11 border-b-2 px-3 text-sm font-medium ${
              tab === value ? 'border-primary-600 text-primary-700' : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {pendingSends.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Not sent yet">
          {pendingSends.map((op) => (
            <li key={op.id}>
              <Link
                to={`/app/transfers/${op.payload.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-3 hover:bg-neutral-50"
                data-receipt="recorded"
              >
                <span className="text-sm text-neutral-900">{op.summary}</span>
                <span className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
                  {op.status === 'needs_attention' ? 'Check' : 'Recorded'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {list.loading && (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}
      {!list.loading && list.error && <ErrorState title="Couldn't load transfers" message={list.error} onRetry={list.refetch} />}

      {!list.loading && !list.error && neverAny && (
        <EmptyState
          icon={Truck}
          title="Moving stock between branches shows here"
          description="Send stock, and the other branch sees it on the way and receives it."
          action={
            canSend ? (
              <Link to="/app/transfers/send" className={buttonClassName('primary')}>
                Send stock
              </Link>
            ) : undefined
          }
        />
      )}

      {!list.loading && !list.error && !neverAny && transfers.length === 0 && tab === 'open' && (
        <div className="flex flex-col gap-3">
          <p className="rounded-lg border border-neutral-200 bg-white px-4 py-6 text-center text-sm text-neutral-600">Nothing on the way.</p>
          {lastReceived.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-neutral-900">Last received</h2>
              <TransferList transfers={lastReceived} />
            </>
          )}
        </div>
      )}

      {!list.loading && !list.error && transfers.length > 0 && <TransferList transfers={transfers} />}
    </div>
  )
}

function TransferList({ transfers }: { transfers: Transfer[] }) {
  return (
    <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
      {transfers.map((transfer) => {
        const items = transfer.lines.length
        return (
          <li key={transfer.id}>
            <Link to={`/app/transfers/${transfer.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-neutral-50">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-neutral-900">
                  {transfer.fromBranchName}
                  <ArrowRight className="h-3.5 w-3.5 text-neutral-400" aria-label="to" />
                  {transfer.toBranchName}
                </p>
                <p className="mt-0.5 text-xs tabular-nums text-neutral-500">
                  {transfer.waybill} · {items} {items === 1 ? 'item' : 'items'} · sent {formatDateTime(transfer.sentAt)}
                  {transfer.sentByName && ` by ${transfer.sentByName}`}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge variant={STATUS_VARIANT[transfer.status]}>{STATUS_LABEL[transfer.status]}</Badge>
                {transfer.missing > 0 && <span className="text-xs text-warning-800">{formatNumber(transfer.missing)} missing</span>}
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
