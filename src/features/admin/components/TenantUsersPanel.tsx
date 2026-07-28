import { useState } from 'react'
import { Lock, Users } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Pagination } from '@/components/Pagination'
import { Skeleton } from '@/components/Skeleton'
import { AdminUserDetailModal } from '@/features/admin/components/AdminUserDetailModal'
import { AdminUserTable } from '@/features/admin/components/AdminUserTable'
import { useClientUsers } from '@/features/admin/hooks/useClientUsers'
import type { SuperAdminUserSummary } from '@/features/admin/types'

const PAGE_SIZE = 20

export interface TenantUsersPanelProps {
  clientId: string
  clientName: string
}

/**
 * The Users section of the tenant detail page. Read-only, permanently: there is no API to write
 * another tenant's users, so this panel offers no create/edit/deactivate affordance and says
 * why, rather than leaving a super admin hunting for a button that was never built.
 */
export function TenantUsersPanel({ clientId, clientName }: TenantUsersPanelProps) {
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<SuperAdminUserSummary | null>(null)

  const { data, loading, error, refetch } = useClientUsers(clientId, { page, size: PAGE_SIZE })

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Users</h2>
          <p className="text-sm text-neutral-500">
            {data ? `${data.totalElements} user${data.totalElements === 1 ? '' : 's'} at ${clientName}` : clientName}
          </p>
        </div>
        <p className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          View only — a tenant&apos;s users can only be changed by that tenant
        </p>
      </div>

      {loading && !data && (
        <div className="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      )}

      {!loading && error && (
        <ErrorState variant="inline" title="Could not load users" message={error} onRetry={refetch} />
      )}

      {!error && data && data.content.length === 0 && (
        <EmptyState
          icon={Users}
          title="No users yet"
          description={`Nobody has been created at ${clientName}. Its account owner is created with the company at signup, so an empty list usually means the tenant was provisioned another way.`}
        />
      )}

      {!error && data && data.content.length > 0 && (
        <>
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <AdminUserTable users={data.content} onRowClick={setSelected} />
          </div>
          <Pagination page={data.number} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      )}

      {selected && (
        <AdminUserDetailModal
          clientId={clientId}
          clientName={clientName}
          user={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  )
}
