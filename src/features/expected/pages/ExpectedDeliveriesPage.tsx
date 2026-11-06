import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PackageSearch, Plus, Search } from 'lucide-react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { buttonClassName } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Pagination } from '@/components/Pagination'
import { Skeleton } from '@/components/Skeleton'
import { useApiQuery } from '@/data/useApiQuery'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { viewingBranchId } from '@/features/branches/viewingBranch'
import { expectedApi } from '@/features/expected/api/expectedApi'
import { priceRequestsApi, type PriceRequestRow } from '@/features/expected/api/priceRequestsApi'
import { StatusPill } from '@/features/expected/components/StatusPill'
import { statusOf } from '@/features/expected/orderStatus'
import { expectedCopy } from '@/features/expected/copy'
import { neededWords, quantityWords } from '@/features/expected/expected'
import type { ExpectedDelivery, PageResponse, PurchaseOrderCounts, PurchaseOrderView } from '@/features/expected/types'
import { copy } from '@/features/imports/copy'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

const PAGE_SIZE = 20
const text = expectedCopy.rows
type Chip = 'TO_APPROVE' | 'RFQ' | 'TO_SEND' | 'WAITING' | 'LATE' | 'ARRIVED' | 'ALL'
const CHIPS: { view: Chip; label: string; count?: keyof PurchaseOrderCounts }[] = [
  { view: 'TO_APPROVE', label: text.toApprove, count: 'toApprove' },
  // Price requests (RFQ-0003) sit in the same list under their own chip (plan section 11.7).
  { view: 'RFQ', label: text.askingForPrices },
  { view: 'TO_SEND', label: text.toSend, count: 'toSend' },
  { view: 'WAITING', label: text.waiting, count: 'waiting' },
  { view: 'LATE', label: text.late, count: 'late' },
  { view: 'ARRIVED', label: text.arrived },
  { view: 'ALL', label: text.all },
]

/**
 * Purchase orders (redesign 2026-11-04, owner-approved mockup G): a search, filter chips that say
 * how many each holds (Pattern B — a zero you can read), and one row per order with one status and
 * the one button it needs next. Calling an order off lives on the order's own page, in ⋯.
 *
 * Opens on "To send" when something is waiting to go to a supplier, else on "Waiting"; the chip is
 * kept in the address (`?view=`) so Back returns to it.
 */
export function ExpectedDeliveriesPage() {
  const { user } = useAuth()
  const permissions = user?.type === 'tenant' ? user.permissions : []
  const canManage = permissions.includes(PERMISSIONS.MANAGE_INVENTORY)
  const canSend = permissions.includes(PERMISSIONS.SEND_PURCHASE_ORDER)
  const canCreate = canSend || permissions.includes(PERMISSIONS.CREATE_PURCHASE_ORDER)
  const branch = useOptionalWorkingBranch()
  const branchKey = viewingBranchId() ?? ''

  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const search = useDebouncedValue(query, 300).trim()
  const [page, setPage] = useState(0)

  const counts = useApiQuery<PurchaseOrderCounts>({
    queryKey: ['expected', 'counts', search, branchKey],
    queryFn: () => expectedApi.counts(search),
    fallbackError: expectedCopy.list.loadFailed,
    keepPrevious: true,
  })
  const chosen = params.get('view') as Chip | null
  // Opens where a hand is needed: approving (for whoever can), then sending, else what's on its way.
  const view: Chip | null =
    chosen ??
    (counts.data
      ? counts.data.toApprove > 0 && canSend
        ? 'TO_APPROVE'
        : counts.data.toSend > 0
          ? 'TO_SEND'
          : 'WAITING'
      : null)

  useEffect(() => setPage(0), [view, search])

  const list = useApiQuery<PageResponse<ExpectedDelivery>>({
    queryKey: ['expected', 'list', 'search', view, search, page, branchKey],
    queryFn: () => expectedApi.list({ view: (view ?? 'ALL') as PurchaseOrderView, search, page, size: PAGE_SIZE }),
    fallbackError: expectedCopy.list.loadFailed,
    keepPrevious: true,
    enabled: view != null && view !== 'RFQ',
  })

  function choose(next: Chip) {
    const nextParams = new URLSearchParams(params)
    nextParams.set('view', next)
    setParams(nextParams, { replace: true })
  }

  const priceCounts = useApiQuery<{ open: number }>({
    queryKey: ['price-requests', 'counts', branchKey],
    queryFn: () => priceRequestsApi.counts(),
    fallbackError: expectedCopy.list.loadFailed,
    keepPrevious: true,
  })
  const priceRows = useApiQuery<PriceRequestRow[]>({
    queryKey: ['price-requests', 'list', branchKey],
    queryFn: () => priceRequestsApi.list('ALL'),
    fallbackError: expectedCopy.list.loadFailed,
    enabled: view === 'RFQ',
  })
  const asking = priceCounts.data?.open ?? 0

  const rfqView = view === 'RFQ'
  const rows = rfqView ? [] : (list.data?.content ?? [])
  const loading = view == null || (rfqView ? priceRows.loading && !priceRows.data : list.loading && !list.data)
  const isEmpty = !loading && (rfqView ? !priceRows.error && (priceRows.data ?? []).length === 0 : !list.error && rows.length === 0)

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-neutral-900">{expectedCopy.list.title}</h1>
          <p className="mt-1 text-sm text-neutral-600">{expectedCopy.list.subtitle}</p>
        </div>
        {canCreate && (
          <div className="flex flex-wrap gap-2">
            <Link to="/app/purchase-orders/new" className={buttonClassName('action')}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {text.new}
            </Link>
            {/* Two buttons because they do two different things (plan section 11.7). */}
            <Link to="/app/purchase-orders/ask" className={buttonClassName('secondary')}>
              {text.askForPrices}
            </Link>
          </div>
        )}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
        <label htmlFor="po-list-search" className="sr-only">
          {text.searchLabel}
        </label>
        <input
          id="po-list-search"
          type="search"
          value={query}
          autoComplete="off"
          placeholder={text.searchPlaceholder}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full rounded-md border border-neutral-200 bg-white py-2.5 pr-3 pl-9 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none sm:text-sm"
        />
      </div>

      <div role="group" aria-label={text.chips} className="flex flex-wrap gap-1.5">
        {CHIPS.filter(
          // "To approve" only where approval happens: a company where everyone can send never sees it.
          (chip) =>
            (chip.view !== 'TO_APPROVE' || view === 'TO_APPROVE' || (counts.data?.toApprove ?? 0) > 0) &&
            (chip.view !== 'RFQ' || view === 'RFQ' || asking > 0),
        ).map((chip) => {
          const on = view === chip.view
          const count = chip.view === 'RFQ' ? asking : chip.count && counts.data ? counts.data[chip.count] : null
          return (
            <button
              key={chip.view}
              type="button"
              aria-pressed={on}
              onClick={() => choose(chip.view)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none ${
                on ? 'border-primary-100 bg-primary-100 font-semibold text-primary-900' : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              {chip.label}
              {count != null && <span className="tabular-nums">{count}</span>}
            </button>
          )
        })}
      </div>

      {loading && (
        <div role="status" className="flex flex-col gap-2" aria-busy="true" aria-label={copy.common.loading}>
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      )}

      {rfqView && !loading && (priceRows.data ?? []).length > 0 && (
        <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
          {(priceRows.data ?? []).map((row) => (
            <RfqRow key={row.id} row={row} />
          ))}
        </ul>
      )}
      {!rfqView && !loading && list.error && <ErrorState title={expectedCopy.list.loadFailed} message={list.error} onRetry={list.refetch} />}

      {isEmpty && view && (
        <EmptyState
          icon={PackageSearch}
          title={search ? text.emptySearch(search) : text.emptyTitle[view]}
          description={search ? undefined : text.emptyBody[view]}
        />
      )}

      {!loading && !list.error && rows.length > 0 && (
        <>
          <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
            {rows.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                canManage={canManage}
                canSend={canSend}
                goingTo={branch?.isMultiBranch && branch.isAll && order.branchId ? branch.nameOf(order.branchId) : undefined}
              />
            ))}
          </ul>
          <Pagination page={list.data?.number ?? 0} totalPages={list.data?.totalPages ?? 1} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}

/** "PO-0007 Tony Stores / 12 bags rice still to come · needed Thu" with its status and next button. */
function OrderRow({
  order,
  canManage,
  canSend,
  goingTo,
}: {
  order: ExpectedDelivery
  canManage: boolean
  canSend: boolean
  goingTo?: string
}) {
  const status = statusOf(order)
  const owed = order.lines.filter((line) => line.outstanding > 0)
  const someArrived = order.lines.some((line) => line.receivedQuantity > 0)
  // Only an open order has anything "still to come"; a closed or called-off one just says how many items.
  const what =
    order.status === 'OPEN' && someArrived && owed.length === 1
      ? text.toCome(`${quantityWords(owed[0].outstanding, owed[0].comesIn).replace(/ \(.*\)$/, '')} ${owed[0].productName.toLowerCase()}`)
      : text.items(order.lines.length)
  const meta = [
    what,
    status === 'sent' && order.sentVia ? text.via[order.sentVia] : null,
    order.status === 'OPEN' ? text.needed(order.expectedDate ? neededWords(order.expectedDate) : text.anyTime) : null,
    goingTo ? text.goingTo(goingTo) : null,
  ].filter(Boolean)
  const href = `/app/purchase-orders/${order.id}`
  const name = order.vendorName ?? order.title

  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3">
      <div className="min-w-0">
        <Link
          to={href}
          className="flex min-w-0 items-baseline gap-2 rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
        >
          {order.poNumber && <span className="shrink-0 font-narrow text-xs font-semibold text-neutral-500 tabular-nums">{order.poNumber}</span>}
          <span className="truncate font-semibold text-neutral-900">{name}</span>
        </Link>
        <p className="mt-0.5 text-xs text-neutral-600">{meta.join(' · ')}</p>
      </div>
      <div className="row-span-2 flex flex-col items-end gap-1.5">
        <StatusPill status={status} />
        {status === 'toApprove' && canSend && (
          <Link to={href} aria-label={text.approveLabel(name)} className={buttonClassName('secondary')}>
            {text.openToApprove}
          </Link>
        )}
        {canSend && (status === 'notSent' || status === 'changed') && (
          <Link to={href} aria-label={text.sendLabel(name)} className={buttonClassName('secondary')}>
            {text.send}
          </Link>
        )}
        {canManage && order.receivable && !['notSent', 'changed', 'toApprove', 'changeAsked'].includes(status) && (
          <Link to={`/app/products/receive?expected=${order.id}`} aria-label={text.receiveLabel(name)} className={buttonClassName('secondary')}>
            {text.receive}
          </Link>
        )}
      </div>
    </li>
  )
}

/** A price request on the list: RFQ number, who was asked, how many replied, and the one next step. */
function RfqRow({ row }: { row: PriceRequestRow }) {
  const href = `/app/purchase-orders/rfq/${row.id}`
  const ready = row.status === 'OPEN' && row.replied > 0
  const meta = [
    row.products.slice(0, 3).join(', ') + (row.products.length > 3 ? '…' : ''),
    row.status === 'OPEN'
      ? text.rfqReplied(row.replied, row.suppliers)
      : row.status === 'DONE' && row.orderNumbers.length > 0
        ? text.rfqBecame(row.orderNumbers.join(', '))
        : text.rfqClosed,
  ]
  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3">
      <div className="min-w-0">
        <Link
          to={href}
          className="flex min-w-0 items-baseline gap-2 rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
        >
          <span className="shrink-0 font-narrow text-xs font-semibold text-neutral-500 tabular-nums">{row.rfqNumber}</span>
          <span className="truncate font-semibold text-neutral-900">{text.rfqSuppliers(row.suppliers)}</span>
        </Link>
        <p className="mt-0.5 text-xs text-neutral-600">{meta.join(' · ')}</p>
      </div>
      <div className="row-span-2 flex flex-col items-end gap-1.5">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
            ready ? 'bg-primary-50 text-primary-700' : row.status === 'OPEN' ? 'bg-neutral-100 text-neutral-700' : 'bg-accent-50 text-accent-800'
          }`}
        >
          {ready ? text.pillCompare : row.status === 'OPEN' ? text.pillAsking : row.status === 'DONE' ? text.pillDone : text.rfqClosed}
        </span>
        {row.status === 'OPEN' && (
          <Link to={href} className={buttonClassName('secondary')}>
            {ready ? text.compare : text.open}
          </Link>
        )}
      </div>
    </li>
  )
}
