import { Plus, Store, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Pagination } from '@/components/Pagination'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/components/useToast'
import { superAdminApiClient } from '@/features/admin/api/superAdminApi'
import { AddVendorModal } from '@/features/admin/components/AddVendorModal'
import { useVendors } from '@/features/admin/hooks/useVendors'
import type { CreateVendorPayload } from '@/features/admin/types'
import { formatDateTime } from '@/features/marketplace/formatters'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { isAppError } from '@/types/api'

const PAGE_SIZE = 20

/** The column stores a fraction in 0..1; people talk in percent. */
function formatCommission(rate: number | null): string {
  if (rate === null || rate === undefined) return '—'
  return `${(rate * 100).toFixed(2).replace(/\.?0+$/, '')}%`
}

/**
 * Marketplace vendor accounts — route `/admin/vendors`.
 *
 * <h2>ProcurePal is deliberately not in this list</h2>
 * ProcurePal sells, but it is a COMPANY that happens to own the marketplace — `client_type` and
 * `is_platform_owner` are orthogonal. The server pins this list to `client_type = VENDOR`, so the
 * platform owner's own row is managed through Tenants like the tenant it is. Anything that treats
 * this screen as "all sellers" is quietly excluding the biggest one.
 *
 * <h2>Suspension is not here</h2>
 * A vendor is a client, and Tenants → detail already suspends any client, with the email that goes
 * with it. A second control on the same column would be one more place to miss when the rules
 * around suspension change. The same reasoning applies to the vendor's password: a vendor has
 * exactly one account, so resetting it is taking over the entire business's presence on the
 * platform, and that decision has not been made (VENDOR_RESEARCH.md section C item 9 says it
 * should be, and it is not this module's).
 *
 * <h2>Why `userCount` is a column</h2>
 * "A vendor has exactly one user account and cannot create staff" is enforced by the VENDOR role
 * not holding MANAGE_USERS, not by a database constraint. This column is the cheapest possible
 * check that the rule is holding, which is why anything other than 1 is called out rather than
 * rendered plainly.
 */
export function AdminVendorsPage() {
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const debouncedSearch = useDebouncedValue(search, 350)

  const { data, vendors, loading, error, refetch } = useVendors({
    search: debouncedSearch || undefined,
    page,
    size: PAGE_SIZE,
  })

  async function handleCreate(payload: CreateVendorPayload) {
    setCreating(true)
    try {
      const vendor = await superAdminApiClient.createVendor(payload)
      showToast(
        `${vendor.name} created. They can sign in as “${vendor.username}” with Company ID “${vendor.slug}”.`,
        'success',
      )
      setAddOpen(false)
      refetch()
    } catch (err: unknown) {
      showToast(isAppError(err) ? err.message : 'We could not create that vendor.', 'error')
    } finally {
      setCreating(false)
    }
  }

  const totalPages = data?.totalPages ?? 0
  const showSkeleton = loading && !data

  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-neutral-900">
            <Store className="h-5 w-5 text-primary-600" aria-hidden="true" />
            Vendors
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            Third-party businesses selling on the marketplace. Procure Paddy's own catalogue is
            managed under Tenants, not here.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add vendor
        </Button>
      </header>

      <div className="mt-5">
        <input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(0)
          }}
          placeholder="Search name or Company ID…"
          aria-label="Search vendors"
          className="w-full max-w-md rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      <div className="mt-4">
        {error && (
          <ErrorState
            variant={vendors.length > 0 ? 'inline' : 'block'}
            title="We could not load vendors"
            message={error}
            onRetry={refetch}
            className={vendors.length > 0 ? 'mb-4' : ''}
          />
        )}

        {showSkeleton && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        )}

        {!showSkeleton && vendors.length > 0 && (
          <>
            <ul className={`space-y-3 transition-opacity ${loading ? 'opacity-50' : ''}`}>
              {vendors.map((vendor) => (
                <li
                  key={vendor.id}
                  className="flex flex-wrap items-start gap-4 rounded-lg border border-neutral-200 bg-white p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-semibold text-neutral-900">{vendor.name}</h2>
                      {vendor.active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="danger">Suspended</Badge>
                      )}
                      {vendor.fromWaitlist ? (
                        <Badge variant="neutral">From waitlist</Badge>
                      ) : (
                        <Badge variant="neutral">Added by ops</Badge>
                      )}
                    </div>

                    <p className="mt-1 font-mono text-xs text-neutral-500">
                      Company ID {vendor.slug}
                      {vendor.username && <> · {vendor.username}</>}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
                      {/* Called out rather than left blank: a vendor with no email receives no
                          order notifications, and a seller who does not hear about an order does
                          not ship it. */}
                      <span>
                        {vendor.email ?? <span className="text-warning-700">No email on file</span>}
                      </span>
                      {vendor.phone && <span>{vendor.phone}</span>}
                      <span>Commission {formatCommission(vendor.commissionRate)}</span>
                      <span>{vendor.productCount} products</span>
                    </div>

                    <p className="mt-2 text-xs text-neutral-400">
                      Created {formatDateTime(vendor.createdAt)}
                    </p>
                  </div>

                  {/* The one-account rule, shown rather than assumed. */}
                  <div className="flex shrink-0 items-center gap-1.5 text-xs text-neutral-500">
                    <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                    {vendor.userCount === 1 ? (
                      <span>1 account</span>
                    ) : (
                      <span className="font-medium text-danger-600">{vendor.userCount} accounts</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-6" />
          </>
        )}

        {!showSkeleton && !error && vendors.length === 0 && (
          <EmptyState
            icon={Store}
            title="No vendors yet"
            description={
              debouncedSearch
                ? `No vendors match “${debouncedSearch}”.`
                : 'Approve an application from the vendor waitlist, or add a business you recruited yourself.'
            }
          />
        )}
      </div>

      <AddVendorModal
        open={addOpen}
        submitting={creating}
        onCancel={() => setAddOpen(false)}
        onConfirm={(payload) => void handleCreate(payload)}
      />
    </div>
  )
}
