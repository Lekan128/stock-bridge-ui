import { Check, ClipboardList, Inbox, Mail, MapPin, Phone, X } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Pagination } from '@/components/Pagination'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/components/useToast'
import { superAdminApiClient } from '@/features/admin/api/superAdminApi'
import { ApproveVendorDialog } from '@/features/admin/components/ApproveVendorDialog'
import { RejectVendorDialog } from '@/features/admin/components/RejectVendorDialog'
import { useVendorWaitlist } from '@/features/admin/hooks/useVendorWaitlist'
import type { VendorApplication, VendorWaitlistStatus } from '@/features/admin/types'
import { formatDateTime } from '@/features/marketplace/formatters'
import { isAppError } from '@/types/api'

const PAGE_SIZE = 20

type Tab = VendorWaitlistStatus | 'ALL'

const TABS: { key: Tab; label: string }[] = [
  { key: 'PENDING', label: 'Awaiting review' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Declined' },
  { key: 'ALL', label: 'All' },
]

/** The four address columns as one line, skipping the ones the applicant left blank. */
function addressOf(application: VendorApplication): string {
  return [application.addressLine1, application.addressLine2, application.city, application.state]
    .filter((part) => part && part.trim() !== '')
    .join(', ')
}

/**
 * The vendor waitlist queue — route `/admin/vendor-waitlist`.
 *
 * <h2>What this screen decides</h2>
 * Approving here is the ONLY way, along with the direct-add button on the Vendors screen, that a
 * VENDOR-role account comes into existence anywhere in the product. `TenantRoles.VENDOR` is
 * deliberately excluded from the assignable-role allow-list and filtered out of `GET /api/roles`,
 * so no tenant OWNER can mint one inside their own company. VENDOR_RESEARCH.md section C item 3
 * is the reason the gate exists at all: without it, anyone who registers is instantly selling to
 * real companies with real money and there is no lever short of deleting rows.
 *
 * <h2>The queue is oldest-first and the history is newest-first</h2>
 * Not an inconsistency. A filtered tab is a queue, and the business that has waited longest goes
 * next; the All tab is a history, and history reads newest-first. The server does this, and this
 * screen only has to not fight it.
 *
 * <h2>Approving twice is a 409, not a no-op</h2>
 * The button is hidden on a reviewed application, but two ops users on two stale tabs are a real
 * thing, so the server refuses the second one rather than creating a second client and orphaning
 * the first vendor account. The refusal arrives as an ordinary toast and the list is refetched, so
 * the reviewer sees the decision somebody else already made.
 */
export function AdminVendorWaitlistPage() {
  const { showToast } = useToast()
  const [tab, setTab] = useState<Tab>('PENDING')
  const [page, setPage] = useState(0)
  const [approveTarget, setApproveTarget] = useState<VendorApplication | null>(null)
  const [rejectTarget, setRejectTarget] = useState<VendorApplication | null>(null)
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)

  const { data, applications, counts, loading, error, refetch } = useVendorWaitlist({
    status: tab === 'ALL' ? undefined : tab,
    page,
    size: PAGE_SIZE,
  })

  function switchTab(next: Tab) {
    setTab(next)
    // Page 7 of "awaiting review" is never a meaningful position in "declined"; landing on an
    // empty page reads as a bug.
    setPage(0)
  }

  async function handleApprove(values: Parameters<typeof superAdminApiClient.approveVendorApplication>[1]) {
    if (!approveTarget) return
    setApproving(true)
    try {
      const vendor = await superAdminApiClient.approveVendorApplication(approveTarget.id, values)
      showToast(
        `${vendor.name} approved. They can sign in as “${vendor.username}” with Company ID “${vendor.slug}”.`,
        'success',
      )
      setApproveTarget(null)
      refetch()
    } catch (err: unknown) {
      showToast(isAppError(err) ? err.message : 'We could not approve that application.', 'error')
      // Refetch even on failure: the most likely error is a 409 because somebody else already
      // decided this one, and the list in front of the reviewer is now wrong.
      refetch()
    } finally {
      setApproving(false)
    }
  }

  async function handleReject(reviewNote: string) {
    if (!rejectTarget) return
    setRejecting(true)
    try {
      await superAdminApiClient.rejectVendorApplication(rejectTarget.id, { reviewNote })
      showToast(`${rejectTarget.businessName} declined. They have been emailed your note.`, 'success')
      setRejectTarget(null)
      refetch()
    } catch (err: unknown) {
      showToast(isAppError(err) ? err.message : 'We could not decline that application.', 'error')
      refetch()
    } finally {
      setRejecting(false)
    }
  }

  const totalPages = data?.totalPages ?? 0
  const showSkeleton = loading && !data
  const busy = approving || rejecting

  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-neutral-900">
            <ClipboardList className="h-5 w-5 text-primary-600" aria-hidden="true" />
            Vendor waitlist
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            Businesses that applied to sell on Procure Paddy. Approving one creates their vendor
            account and emails them their login; declining sends them your note.
          </p>
        </div>
        {counts && (
          <div className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-center">
            <p className="text-2xl font-bold text-neutral-900">{counts.pending}</p>
            <p className="text-xs text-neutral-500">waiting on you</p>
          </div>
        )}
      </header>

      <div className="mt-5 flex flex-wrap gap-1 rounded-lg border border-neutral-200 bg-white p-1">
        {TABS.map((entry) => {
          const count =
            entry.key === 'PENDING'
              ? counts?.pending
              : entry.key === 'APPROVED'
                ? counts?.approved
                : entry.key === 'REJECTED'
                  ? counts?.rejected
                  : undefined
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => switchTab(entry.key)}
              aria-current={tab === entry.key ? 'page' : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                tab === entry.key
                  ? 'bg-primary-600 text-white'
                  : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
              }`}
            >
              {entry.label}
              {count !== undefined && <span className="ml-1.5 text-xs opacity-75">{count}</span>}
            </button>
          )
        })}
      </div>

      <div className="mt-4">
        {error && (
          <ErrorState
            variant={applications.length > 0 ? 'inline' : 'block'}
            title="We could not load the vendor waitlist"
            message={error}
            onRetry={refetch}
            className={applications.length > 0 ? 'mb-4' : ''}
          />
        )}

        {showSkeleton && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        )}

        {!showSkeleton && applications.length > 0 && (
          <>
            <ul className={`space-y-3 transition-opacity ${loading ? 'opacity-50' : ''}`}>
              {applications.map((application) => {
                const address = addressOf(application)
                return (
                  <li
                    key={application.id}
                    className="flex flex-wrap items-start gap-4 rounded-lg border border-neutral-200 bg-white p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-sm font-semibold text-neutral-900">
                          {application.businessName}
                        </h2>
                        {application.status === 'PENDING' && <Badge variant="warning">Awaiting review</Badge>}
                        {application.status === 'APPROVED' && <Badge variant="success">Approved</Badge>}
                        {application.status === 'REJECTED' && <Badge variant="danger">Declined</Badge>}
                      </div>

                      {/* Everything a reviewer needs to research the business, without a second
                          click — the same set the notification email carries. */}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
                        <span className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <a href={`mailto:${application.email}`} className="hover:underline">
                            {application.email}
                          </a>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <a href={`tel:${application.contactPhone}`} className="hover:underline">
                            {application.contactPhone}
                          </a>
                        </span>
                        {address && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            {address}
                          </span>
                        )}
                      </div>

                      {/* The applicant's own words — the field a reviewer reads first. */}
                      {application.notes && (
                        <p className="mt-2 rounded-md bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-700">
                          {application.notes}
                        </p>
                      )}

                      {application.reviewNote && (
                        <p className="mt-2 rounded-md bg-primary-50 px-2.5 py-1.5 text-xs text-primary-800">
                          <span className="font-semibold">Your note: </span>
                          {application.reviewNote}
                        </p>
                      )}

                      <p className="mt-2 text-xs text-neutral-400">
                        Applied {formatDateTime(application.createdAt)}
                        {application.reviewedAt && ` · reviewed ${formatDateTime(application.reviewedAt)}`}
                      </p>
                    </div>

                    {/* Only a PENDING application can be acted on. A reviewed one shows no buttons
                        rather than disabled ones: the decision is made, and the server would
                        refuse a second one anyway. */}
                    {application.status === 'PENDING' && (
                      <div className="flex shrink-0 gap-2">
                        <Button variant="primary" onClick={() => setApproveTarget(application)} disabled={busy}>
                          <Check className="h-4 w-4" aria-hidden="true" />
                          Approve
                        </Button>
                        <Button variant="secondary" onClick={() => setRejectTarget(application)} disabled={busy}>
                          <X className="h-4 w-4" aria-hidden="true" />
                          Decline
                        </Button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>

            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-6" />
          </>
        )}

        {!showSkeleton && !error && applications.length === 0 && (
          <EmptyState
            icon={Inbox}
            title={tab === 'PENDING' ? 'Nothing waiting for review' : 'Nothing here'}
            description={
              tab === 'PENDING'
                ? 'Every application has been reviewed. New ones appear here as businesses apply.'
                : 'No applications in this state yet.'
            }
          />
        )}
      </div>

      <ApproveVendorDialog
        application={approveTarget}
        submitting={approving}
        onCancel={() => setApproveTarget(null)}
        onConfirm={(values) => void handleApprove(values)}
      />
      <RejectVendorDialog
        application={rejectTarget}
        submitting={rejecting}
        onCancel={() => setRejectTarget(null)}
        onConfirm={(reviewNote) => void handleReject(reviewNote)}
      />
    </div>
  )
}
