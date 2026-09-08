import { useState } from 'react'
import { Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/components/useToast'
import { rolesManagementApi } from '@/features/roles/api/rolesManagementApi'
import { RoleFormModal } from '@/features/roles/components/RoleFormModal'
import { formatPermissionName, formatRoleName } from '@/features/users/formatters'
import { useRoles } from '@/features/users/hooks/useRoles'
import type { Role } from '@/features/users/types'
import { isAppError } from '@/types/api'

type ModalState = { type: 'create' } | { type: 'edit'; role: Role } | null

export function RolesPage() {
  const { showToast } = useToast()
  const { data: roles, loading, error, refetch } = useRoles()
  const [modal, setModal] = useState<ModalState>(null)
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null)
  const [deleting, setDeleting] = useState(false)

  function handleSaved(role: Role) {
    setModal(null)
    showToast(`Role "${role.name}" saved.`, 'success')
    refetch()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await rolesManagementApi.delete(deleteTarget.id)
      showToast(`Role "${deleteTarget.name}" deleted.`, 'success')
      setDeleteTarget(null)
      refetch()
    } catch (err) {
      showToast(isAppError(err) ? err.message : 'Could not delete the role.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Roles & Privileges</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            System roles are fixed. Create a custom role to hand out any other combination of privileges.
          </p>
        </div>
        <Button onClick={() => setModal({ type: 'create' })}>
          <Plus className="h-4 w-4" />
          New role
        </Button>
      </div>

      {loading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      {!loading && !error && roles && (
        <div className="flex flex-col gap-2">
          {roles.map((role) => (
            <div
              key={role.id}
              className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-neutral-900">
                    {role.isSystem ? formatRoleName(role.name) : role.name}
                  </span>
                  {role.isSystem && (
                    <Badge variant="neutral">
                      <Lock className="h-3 w-3" />
                      System role
                    </Badge>
                  )}
                </div>
                {role.description && <p className="mt-0.5 text-xs text-neutral-500">{role.description}</p>}
                <p className="mt-1.5 text-xs text-neutral-500">
                  {role.permissions.length === 0
                    ? 'No privileges granted.'
                    : role.permissions.map(formatPermissionName).join(' · ')}
                </p>
              </div>

              {!role.isSystem && (
                <div className="flex shrink-0 gap-2">
                  <Button variant="secondary" onClick={() => setModal({ type: 'edit', role })}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button variant="secondary" onClick={() => setDeleteTarget(role)}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal?.type === 'create' && <RoleFormModal onClose={() => setModal(null)} onSuccess={handleSaved} />}
      {modal?.type === 'edit' && (
        <RoleFormModal role={modal.role} onClose={() => setModal(null)} onSuccess={handleSaved} />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete role"
        message={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
