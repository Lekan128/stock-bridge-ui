import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Pagination } from '@/components/Pagination'
import { useToast } from '@/components/useToast'
import { usersApi } from '@/features/users/api/usersApi'
import { AddUserModal } from '@/features/users/components/AddUserModal'
import { EditUserModal } from '@/features/users/components/EditUserModal'
import { ResetPasswordModal } from '@/features/users/components/ResetPasswordModal'
import { UserCard } from '@/features/users/components/UserCard'
import { UserListSkeleton } from '@/features/users/components/UserListSkeleton'
import { UserTable } from '@/features/users/components/UserTable'
import { useUsers } from '@/features/users/hooks/useUsers'
import type { TenantUserSummary } from '@/features/users/types'
import { isAppError } from '@/types/api'

const PAGE_SIZE = 20

type ModalState =
  | { type: 'add' }
  | { type: 'edit'; user: TenantUserSummary }
  | { type: 'reset'; user: TenantUserSummary }
  | null

export function UserListPage() {
  const { user: currentUser } = useAuth()
  const { showToast } = useToast()
  const [page, setPage] = useState(0)
  const [modal, setModal] = useState<ModalState>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<TenantUserSummary | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  const { data, loading, error, refetch } = useUsers({ page, size: PAGE_SIZE })

  const currentUserId = currentUser?.type === 'tenant' ? currentUser.id : undefined

  function handleAddSuccess(created: TenantUserSummary) {
    setModal(null)
    showToast(`User "${created.username}" created.`, 'success')
    setPage(0)
    refetch()
  }

  function handleEditSuccess() {
    setModal(null)
    showToast('User updated.', 'success')
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
      await usersApi.deactivate(deactivateTarget.id)
      setDeactivateTarget(null)
      showToast(`User "${deactivateTarget.username}" deactivated.`, 'success')
      refetch()
    } catch (err) {
      showToast(isAppError(err) ? err.message : 'Could not deactivate the user.', 'error')
    } finally {
      setDeactivating(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Users</h1>
        <Button onClick={() => setModal({ type: 'add' })}>
          <UserPlus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      {loading && <UserListSkeleton />}

      {!loading && error && (
        <div className="rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      {!loading && !error && data && (
        <>
          {data.content.length === 0 ? (
            <p className="rounded-lg border border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-500">
              No users yet.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-2 md:hidden">
                {data.content.map((user) => (
                  <UserCard
                    key={user.id}
                    user={user}
                    currentUserId={currentUserId}
                    onEdit={(u) => setModal({ type: 'edit', user: u })}
                    onResetPassword={(u) => setModal({ type: 'reset', user: u })}
                    onDeactivate={setDeactivateTarget}
                  />
                ))}
              </div>
              <div className="hidden overflow-hidden rounded-lg border border-neutral-200 bg-white md:block">
                <UserTable
                  users={data.content}
                  currentUserId={currentUserId}
                  onEdit={(u) => setModal({ type: 'edit', user: u })}
                  onResetPassword={(u) => setModal({ type: 'reset', user: u })}
                  onDeactivate={setDeactivateTarget}
                />
              </div>
            </>
          )}
          <Pagination page={data.number} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      )}

      {modal?.type === 'add' && <AddUserModal onClose={() => setModal(null)} onSuccess={handleAddSuccess} />}
      {modal?.type === 'edit' && (
        <EditUserModal user={modal.user} onClose={() => setModal(null)} onSuccess={handleEditSuccess} />
      )}
      {modal?.type === 'reset' && (
        <ResetPasswordModal user={modal.user} onClose={() => setModal(null)} onSuccess={handleResetSuccess} />
      )}

      <ConfirmDialog
        open={deactivateTarget !== null}
        title="Deactivate user"
        message={
          deactivateTarget
            ? `Are you sure you want to deactivate "${deactivateTarget.username}"? They will no longer be able to log in.`
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
