import { useState } from 'react'
import { Mail, Pencil, Phone, Plus, Search, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorState } from '@/components/ErrorState'
import { Pagination } from '@/components/Pagination'
import { useToast } from '@/components/useToast'
import { vendorsApi } from '@/features/vendors/api/vendorsApi'
import { EmptyVendorsState } from '@/features/vendors/components/EmptyVendorsState'
import { VendorFormModal } from '@/features/vendors/components/VendorFormModal'
import { VendorKindBadge } from '@/features/vendors/components/VendorKindBadge'
import { VendorListSkeleton } from '@/features/vendors/components/VendorListSkeleton'
import { useVendors } from '@/features/vendors/hooks/useVendors'
import type { CompanyVendor, VendorKind } from '@/features/vendors/types'
import { isAppError } from '@/types/api'

/** `undefined` = closed; `null` = open on a new supplier; a vendor = open for editing. */
type FormTarget = CompanyVendor | null | undefined

type KindFilter = 'all' | VendorKind

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'VERIFIED', label: 'ProcurePaddy sellers' },
  { value: 'EXTERNAL', label: 'Your own suppliers' },
]

/**
 * The company's vendor directory — `/app/vendors`.
 *
 * The route is gated on VIEW_VENDORS; the add/edit/remove affordances are gated separately on
 * MANAGE_VENDORS, because reading is deliberately wider than writing (a finance officer reconciles
 * against what was paid without maintaining the list).
 *
 * **Both kinds are shown in one list by default.** VERIFIED vs EXTERNAL is a fact about where a
 * row came from, not a category of business a buyer wants to choose between before they have
 * looked — splitting them into two tabs would present an implementation detail as a decision. The
 * filter exists for the one real use ("which of these are actually on the marketplace"), and the
 * badge carries the distinction everywhere else.
 */
export function VendorListPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [page, setPage] = useState(0)
  const [kind, setKind] = useState<KindFilter>('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [formTarget, setFormTarget] = useState<FormTarget>(undefined)
  const [deleteTarget, setDeleteTarget] = useState<CompanyVendor | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { data, loading, error, refetch } = useVendors({
    kind: kind === 'all' ? undefined : kind,
    search: search || undefined,
    page,
    size: 20,
  })

  const canManage = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.MANAGE_VENDORS)
  const vendors = data?.content ?? []
  const filtered = kind !== 'all' || search.length > 0

  function applySearch(value: string) {
    setSearch(value)
    // A search that kept you on page 4 of the old result set shows an empty page for no visible
    // reason — the classic paginated-filter bug.
    setPage(0)
  }

  function handleKindChange(next: KindFilter) {
    setKind(next)
    setPage(0)
  }

  function handleSaved(saved: CompanyVendor) {
    setFormTarget(undefined)
    showToast(`${saved.name} saved.`, 'success')
    refetch()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await vendorsApi.remove(deleteTarget.id)
      showToast(`${deleteTarget.name} removed from your directory.`, 'success')
      setDeleteTarget(null)
      refetch()
    } catch (err: unknown) {
      showToast(isAppError(err) ? err.message : 'Could not remove this supplier.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Suppliers</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Everyone your company buys from — ProcurePaddy sellers you have ordered from, and the
            suppliers you deal with off-platform.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setFormTarget(null)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add supplier
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form
          className="relative flex-1"
          onSubmit={(event) => {
            event.preventDefault()
            applySearch(searchInput.trim())
          }}
        >
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by name"
            aria-label="Search suppliers by name"
            className="w-full rounded-md border border-neutral-200 py-2 pr-3 pl-9 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
          />
        </form>

        <div className="flex items-center gap-1 rounded-md border border-neutral-200 bg-white p-1">
          {KIND_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleKindChange(option.value)}
              aria-pressed={kind === option.value}
              className={`rounded-sm px-2.5 py-1.5 text-sm font-medium transition-colors ${
                kind === option.value ? 'bg-primary-50 text-primary-700' : 'text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <VendorListSkeleton />}

      {!loading && error && <ErrorState title="Could not load your suppliers" message={error} onRetry={refetch} />}

      {!loading && !error && vendors.length === 0 && (
        <EmptyVendorsState
          canManage={canManage}
          filtered={filtered}
          onAdd={() => setFormTarget(null)}
          onClearFilters={() => {
            setSearchInput('')
            applySearch('')
            setKind('all')
          }}
        />
      )}

      {!loading && !error && vendors.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {vendors.map((vendor) => (
              <div
                key={vendor.id}
                // A tinted rail on the automatic entries as well as the badge: in a grid of twenty,
                // a lone badge is easy to scan past, and "did we actually buy from this one" is the
                // question the whole distinction exists to answer.
                className={`flex flex-col rounded-lg border border-neutral-200 bg-white ${
                  vendor.kind === 'VERIFIED' ? 'border-l-4 border-l-primary-600' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/app/vendors/${vendor.id}`}
                        className="truncate text-sm font-semibold text-neutral-900 hover:text-primary-700 hover:underline"
                      >
                        {vendor.name}
                      </Link>
                      <VendorKindBadge kind={vendor.kind} />
                    </div>
                    <div className="mt-2 flex flex-col gap-1 text-sm text-neutral-600">
                      {vendor.contactPhone && (
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
                          {vendor.contactPhone}
                        </span>
                      )}
                      {vendor.email && (
                        <span className="inline-flex items-center gap-1.5 truncate">
                          <Mail className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
                          <span className="truncate">{vendor.email}</span>
                        </span>
                      )}
                      {(vendor.city || vendor.state) && (
                        <span className="text-neutral-500">
                          {[vendor.city, vendor.state].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex shrink-0 items-center gap-1">
                      {/* Driven by the server's `editable` flag, not by `kind` — the rule has one
                          definition and it lives on the server. A VERIFIED row shows no pencil
                          because the edit would be refused with a 409. */}
                      {vendor.editable && (
                        <button
                          type="button"
                          onClick={() => setFormTarget(vendor)}
                          aria-label={`Edit ${vendor.name}`}
                          className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {/* Removal IS offered on both kinds: taking a supplier off your own list is
                          your call, where renaming a verified one is a claim about their account. */}
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(vendor)}
                        aria-label={`Remove ${vendor.name}`}
                        className="rounded-md p-1.5 text-neutral-400 hover:bg-danger-50 hover:text-danger-600 focus-visible:ring-2 focus-visible:ring-danger-500 focus-visible:outline-none"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-auto flex items-center gap-4 border-t border-neutral-100 px-4 py-2.5 text-xs">
                  <Link to={`/app/vendors/${vendor.id}`} className="font-medium text-primary-600 hover:underline">
                    View details
                  </Link>
                  <Link
                    to={`/app/vendors/${vendor.id}/purchases`}
                    className="font-medium text-primary-600 hover:underline"
                  >
                    Purchase history
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <Pagination page={data?.number ?? 0} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
        </>
      )}

      {formTarget !== undefined && (
        <VendorFormModal
          vendor={formTarget ?? undefined}
          onClose={() => setFormTarget(undefined)}
          onSaved={handleSaved}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove this supplier?"
        // Says what survives, because "remove" reads as "destroy" and this one genuinely is not:
        // orders and stock keep their record, and a marketplace seller comes back by itself.
        message={
          deleteTarget?.kind === 'VERIFIED'
            ? `${deleteTarget.name} will stop appearing in your supplier directory. Your orders and purchase history are kept, and they will be added back automatically if you buy from them again.`
            : `${deleteTarget?.name ?? 'This supplier'} will stop appearing in your supplier directory. Products you linked to them keep their record of where the stock came from.`
        }
        confirmLabel="Remove"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
