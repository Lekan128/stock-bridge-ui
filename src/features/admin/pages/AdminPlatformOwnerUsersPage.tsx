import { useState } from 'react'
import { ShieldCheck, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Pagination } from '@/components/Pagination'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/components/useToast'
import { superAdminApiClient } from '@/features/admin/api/superAdminApi'
import { AddPlatformOwnerUserModal } from '@/features/admin/components/AddPlatformOwnerUserModal'
import { AdminUserTable } from '@/features/admin/components/AdminUserTable'
import { EditPlatformOwnerUserModal } from '@/features/admin/components/EditPlatformOwnerUserModal'
import { PlatformOwnerNotBootstrappedState } from '@/features/admin/components/PlatformOwnerNotBootstrappedState'
import { ResetPlatformOwnerPasswordModal } from '@/features/admin/components/ResetPlatformOwnerPasswordModal'
import { usePlatformOwnerUsers } from '@/features/admin/hooks/usePlatformOwnerUsers'
import type { SuperAdminUserSummary } from '@/features/admin/types'
import { UserActionsMenu } from '@/features/users/components/UserActionsMenu'
import { formatRoleName } from '@/features/users/formatters'
import { isAppError } from '@/types/api'

const PAGE_SIZE = 20

type ModalState =
  | { type: 'add' }
  | { type: 'edit'; user: SuperAdminUserSummary }
  | { type: 'reset'; user: SuperAdminUserSummary }
  | null

/**
 * Manage ProcurePal's own users — the one tenant a super admin may write.
 *
 * Every other tenant is read-only from the super admin panel (see TenantUsersPanel), and that
 * asymmetry is the backend's, not a gap here: creating an OWNER or resetting a password inside a
 * customer's tenant would be a silent account-takeover capability over their inventory and
 * prices, so no such endpoint exists to call.
 */
export function AdminPlatformOwnerUsersPage() {
  const { showToast } = useToast()
  const [page, setPage] = useState(0)
  const [modal, setModal] = useState<ModalState>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<SuperAdminUserSummary | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  const { data, loading, error, notBootstrapped, notBootstrappedMessage, refetch } = usePlatformOwnerUsers({
    page,
    size: PAGE_SIZE,
  })

  // The backend makes the first user in an empty tenant the root account and forces it to OWNER.
  // totalElements, not the current page's length — page 2 of an existing list is never "first".
  const isFirstUser = data !== null && data.totalElements === 0

  function handleAddSuccess(created: SuperAdminUserSummary) {
    setModal(null)
    // Reports what was actually created rather than what was asked for: the first account comes
    // back as root/OWNER whichever role the form sent.
    showToast(
      created.root
        ? `"${created.username}" created as ProcurePal's account owner (${formatRoleName(created.role)}).`
        : `User "${created.username}" created with the ${formatRoleName(created.role)} role.`,
      'success',
    )
    setPage(0)
    refetch()
  }

  function handleEditSuccess(updated: SuperAdminUserSummary) {
    setModal(null)
    showToast(`"${updated.username}" updated — ${formatRoleName(updated.role)}, ${updated.active ? 'active' : 'inactive'}.`, 'success')
    refetch()
  }

  function handleResetSuccess() {
    setModal(null)
    showToast('Password reset.', 'success')
  }

  async function handleDeactivate() {
    if (!deactivateTarget) return
    setDeactivating(true)
    try {
      await superAdminApiClient.deactivatePlatformOwnerUser(deactivateTarget.id)
      setDeactivateTarget(null)
      showToast(`"${deactivateTarget.username}" deactivated.`, 'success')
      refetch()
    } catch (err) {
      // 409 when this is the last active OWNER — the server's sentence explains it better than
      // a generic failure would.
      showToast(isAppError(err) ? err.message : 'Could not deactivate this user.', 'error')
    } finally {
      setDeactivating(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">ProcurePal Users</h1>
          <p className="text-sm text-neutral-500">
            The marketplace operator&apos;s own staff accounts — the only tenant whose users can be
            changed from here.
          </p>
        </div>
        {!notBootstrapped && !error && (
          <Button onClick={() => setModal({ type: 'add' })} disabled={loading && !data}>
            <UserPlus className="h-4 w-4" />
            Add User
          </Button>
        )}
      </div>

      {loading && !data && !notBootstrapped && (
        <div className="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      )}

      {!loading && notBootstrapped && (
        <PlatformOwnerNotBootstrappedState message={notBootstrappedMessage} onRetry={refetch} />
      )}

      {!loading && error && (
        <ErrorState title="Could not load ProcurePal's users" message={error} onRetry={refetch} />
      )}

      {!error && !notBootstrapped && data && (
        <>
          {data.content.length === 0 ? (
            <EmptyState
              icon={Users}
              title="ProcurePal has no users yet"
              description="The first account created here becomes ProcurePal's account owner — the root user, forced to the Owner role, and the only one that can never be demoted or deactivated."
              action={
                <Button onClick={() => setModal({ type: 'add' })}>
                  <ShieldCheck className="h-4 w-4" />
                  Create account owner
                </Button>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
              <AdminUserTable
                users={data.content}
                renderActions={(user) => (
                  <UserActionsMenu
                    user={user}
                    // Resetting the root user's password IS allowed on this surface — it is the
                    // lockout-recovery path. Demotion and deactivation still are not.
                    allowRootPasswordReset
                    onEdit={() => setModal({ type: 'edit', user })}
                    onResetPassword={() => setModal({ type: 'reset', user })}
                    onDeactivate={() => setDeactivateTarget(user)}
                  />
                )}
              />
            </div>
          )}
          <Pagination page={data.number} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      )}

      {modal?.type === 'add' && (
        <AddPlatformOwnerUserModal
          isFirstUser={isFirstUser}
          onClose={() => setModal(null)}
          onSuccess={handleAddSuccess}
        />
      )}
      {modal?.type === 'edit' && (
        <EditPlatformOwnerUserModal
          user={modal.user}
          onClose={() => setModal(null)}
          onSuccess={handleEditSuccess}
        />
      )}
      {modal?.type === 'reset' && (
        <ResetPlatformOwnerPasswordModal
          user={modal.user}
          onClose={() => setModal(null)}
          onSuccess={handleResetSuccess}
        />
      )}

      <ConfirmDialog
        open={deactivateTarget !== null}
        title="Deactivate user"
        message={
          deactivateTarget
            ? `Deactivate "${deactivateTarget.username}"? They will no longer be able to log in. Their history is kept, and they can be reactivated from the edit dialog.`
            : ''
        }
        confirmLabel="Deactivate"
        loading={deactivating}
        onConfirm={() => void handleDeactivate()}
        onCancel={() => setDeactivateTarget(null)}
      />
    </div>
  )
}
