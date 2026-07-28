import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Skeleton } from '@/components/Skeleton'
import { superAdminApiClient } from '@/features/admin/api/superAdminApi'
import type { SuperAdminUserSummary } from '@/features/admin/types'
import { AccountOwnerBadge } from '@/features/users/components/AccountOwnerBadge'
import { RoleBadge } from '@/features/users/components/RoleBadge'
import { UserStatusBadge } from '@/features/users/components/UserStatusBadge'
import { formatDate, formatDisplayName } from '@/features/users/formatters'
import { isAppError } from '@/types/api'

export interface AdminUserDetailModalProps {
  clientId: string
  clientName: string
  /** The row that was clicked — shown immediately so the modal is never blank. */
  user: SuperAdminUserSummary
  onClose: () => void
}

/**
 * A single tenant user, re-fetched from GET /api/superadmin/clients/{id}/users/{userId}.
 *
 * The listing row is rendered straight away and the fetch only refreshes it, so a slow or failed
 * request degrades to "what the list already knew" rather than to an empty dialog.
 *
 * Read-only, and says so. A super admin cannot write another tenant's users through any API —
 * there is no endpoint to call — so the dialog states that rather than showing controls that
 * would 403 or, worse, look like an oversight to be fixed later.
 */
export function AdminUserDetailModal({ clientId, clientName, user, onClose }: AdminUserDetailModalProps) {
  const [detail, setDetail] = useState<SuperAdminUserSummary>(user)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    superAdminApiClient
      .getClientUser(clientId, user.id)
      .then((response) => {
        if (!cancelled) setDetail(response)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(isAppError(err) ? err.message : 'Could not refresh this user.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [clientId, user.id])

  return (
    <Modal
      open
      onClose={onClose}
      title={formatDisplayName(detail)}
      size="md"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <RoleBadge role={detail.role} />
          {detail.root && <AccountOwnerBadge title="The first user created in this company — its account owner" />}
          <UserStatusBadge active={detail.active} />
        </div>

        {error && (
          <p role="alert" className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
            {error} Showing the details from the list instead.
          </p>
        )}

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        ) : (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Fact label="Username" value={detail.username} />
            <Fact label="Company" value={clientName} />
            <Fact label="First name" value={detail.firstName || '—'} />
            <Fact label="Last name" value={detail.lastName || '—'} />
            <Fact label="Email" value={detail.email || '—'} />
            <Fact label="Phone" value={detail.phone || '—'} />
            <Fact label="Job title" value={detail.jobTitle || '—'} />
            <Fact label="Created" value={formatDate(detail.createdAt)} />
          </dl>
        )}

        <p className="flex items-start gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
          <span>
            Another company&apos;s users can be viewed but never edited from here. Ask an account
            owner at {clientName} to make changes.
          </span>
        </p>
      </div>
    </Modal>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium break-words text-neutral-900">{value}</dd>
    </div>
  )
}
