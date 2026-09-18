import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PackageSearch, Plus } from 'lucide-react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { buttonClassName } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Pagination } from '@/components/Pagination'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/components/useToast'
import { expectedApi } from '@/features/expected/api/expectedApi'
import { CancelExpectedDialog } from '@/features/expected/components/CancelExpectedDialog'
import { ExpectedDeliveryCard } from '@/features/expected/components/ExpectedDeliveryCard'
import { expectedCopy } from '@/features/expected/copy'
import { useExpectedDeliveries } from '@/features/expected/hooks/useExpectedDeliveries'
import type { ExpectedDelivery } from '@/features/expected/types'
import { copy } from '@/features/imports/copy'
import { isAppError } from '@/types/api'

const PAGE_SIZE = 20

/**
 * "Expected deliveries" (`BULK_IMPORT_CX_PLAN.md` task 3.1) — what a company has ordered from a
 * supplier off the platform and has not received yet.
 *
 * The gap it fills: a marketplace order shows up as incoming the moment it is paid for, but a
 * hundred bags ordered from Tony Stores by phone leave no trace at all until they turn up. So
 * "what have we got coming?" had no answer, and receiving meant typing the whole delivery again.
 *
 * Opens on what is still coming, because that is the question. "All" is one tap away for anyone
 * looking back at what a supplier promised and never brought — which is the other reason a
 * called-off record is kept rather than deleted.
 */
export function ExpectedDeliveriesPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const permissions = user?.type === 'tenant' ? user.permissions : []
  const canManage = permissions.includes(PERMISSIONS.MANAGE_INVENTORY)

  const [openOnly, setOpenOnly] = useState(true)
  const [page, setPage] = useState(0)
  const [cancelTarget, setCancelTarget] = useState<ExpectedDelivery | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const { data, loading, error, refetch, replace } = useExpectedDeliveries(
    openOnly ? 'OPEN' : undefined,
    page,
    PAGE_SIZE,
  )

  function handleFilterChange(nextOpenOnly: boolean) {
    setOpenOnly(nextOpenOnly)
    setPage(0)
  }

  function openCancel(expected: ExpectedDelivery) {
    setCancelError(null)
    setCancelTarget(expected)
  }

  async function handleCancel() {
    if (!cancelTarget) return
    setCancelling(true)
    setCancelError(null)
    try {
      const updated = await expectedApi.cancel(cancelTarget.id)
      // The OPEN tab no longer holds it, so the page is refetched there rather than patched —
      // otherwise the row would sit on screen wearing a badge that says it does not belong.
      if (openOnly) refetch()
      else replace(updated)
      showToast(expectedCopy.cancel.done, 'success')
      setCancelTarget(null)
    } catch (err: unknown) {
      setCancelError(isAppError(err) ? err.message : expectedCopy.cancel.failed)
    } finally {
      setCancelling(false)
    }
  }

  const rows = data?.content ?? []
  const isEmpty = !loading && !error && rows.length === 0

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-neutral-900">{expectedCopy.list.title}</h1>
          <p className="mt-1 text-sm text-neutral-600">{expectedCopy.list.subtitle}</p>
        </div>
        {canManage && (
          <Link to="/app/products/expected/new" className={buttonClassName('primary')}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {expectedCopy.list.add}
          </Link>
        )}
      </div>

      <div
        role="group"
        aria-label={expectedCopy.list.filterLabel}
        className="flex items-center gap-1 self-start rounded-md border border-neutral-200 bg-neutral-50 p-0.5"
      >
        {[
          { value: true, label: expectedCopy.list.filterOpen },
          { value: false, label: expectedCopy.list.filterAll },
        ].map((option) => (
          <button
            key={option.label}
            type="button"
            aria-pressed={openOnly === option.value}
            onClick={() => handleFilterChange(option.value)}
            className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
              openOnly === option.value
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label={copy.common.loading}>
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-32 w-full" />
          ))}
        </div>
      )}

      {!loading && error && <ErrorState title={expectedCopy.list.loadFailed} message={error} onRetry={refetch} />}

      {isEmpty && (
        <EmptyState
          icon={PackageSearch}
          title={openOnly ? expectedCopy.list.emptyOpenTitle : expectedCopy.list.emptyAllTitle}
          description={openOnly ? expectedCopy.list.emptyOpenBody : expectedCopy.list.emptyAllBody}
          action={
            canManage ? (
              <Link to="/app/products/expected/new" className={buttonClassName('primary')}>
                {expectedCopy.list.add}
              </Link>
            ) : undefined
          }
        />
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          <ul className="flex flex-col gap-3">
            {rows.map((expected) => (
              <ExpectedDeliveryCard key={expected.id} expected={expected} onCancel={openCancel} />
            ))}
          </ul>
          <Pagination page={data?.number ?? 0} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
        </>
      )}

      <CancelExpectedDialog
        expected={cancelTarget}
        cancelling={cancelling}
        error={cancelError}
        onConfirm={() => void handleCancel()}
        onClose={() => {
          if (!cancelling) setCancelTarget(null)
        }}
      />
    </div>
  )
}
