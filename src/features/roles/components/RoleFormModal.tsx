import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { Modal } from '@/components/Modal'
import { Skeleton } from '@/components/Skeleton'
import { TextField } from '@/components/TextField'
import { rolesManagementApi } from '@/features/roles/api/rolesManagementApi'
import { usePermissionCatalog } from '@/features/roles/hooks/usePermissionCatalog'
import { PERMISSION_CATEGORIES } from '@/features/roles/permissionCategories'
import { roleFormSchema, type RoleFormValues } from '@/features/roles/schemas'
import { formatPermissionName } from '@/features/users/formatters'
import type { Role } from '@/features/users/types'
import { isAppError } from '@/types/api'

export interface RoleFormModalProps {
  /** Present when editing a custom role; absent when creating a new one. */
  role?: Role
  onClose: () => void
  onSuccess: (role: Role) => void
}

export function RoleFormModal({ role, onClose, onSuccess }: RoleFormModalProps) {
  const isEdit = role !== undefined
  const { data: permissions, loading: loadingPermissions, error: permissionsError } = usePermissionCatalog()
  const [selected, setSelected] = useState<Set<string>>(new Set(role?.permissions ?? []))
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: { name: role?.name ?? '', description: role?.description ?? '' },
  })

  function toggle(code: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  async function onSubmit(values: RoleFormValues) {
    setFormError(null)
    const payload = {
      name: values.name,
      description: values.description === '' ? undefined : values.description,
      permissionCodes: Array.from(selected),
    }

    try {
      const saved = isEdit ? await rolesManagementApi.update(role.id, payload) : await rolesManagementApi.create(payload)
      onSuccess(saved)
    } catch (err) {
      if (isAppError(err) && err.status === 409) {
        setError('name', { message: err.message })
        return
      }
      setFormError(isAppError(err) ? err.message : 'Something went wrong. Please try again.')
    }
  }

  // The catalogue may include codes this matrix doesn't categorise (see permissionCategories.ts) —
  // rendered only from PERMISSION_CATEGORIES, so an uncategorised code silently doesn't appear
  // rather than needing a second allow-list kept in sync with the first.
  const knownCodes = new Set((permissions ?? []).map((p) => p.code))

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Edit ${role.name}` : 'New role'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Create role'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <TextField
          label="Name"
          hint="Shown exactly as typed — e.g. “Warehouse Clerk”"
          error={errors.name?.message}
          {...register('name')}
        />
        <TextField label="Description" error={errors.description?.message} {...register('description')} />

        <div>
          <span className="mb-1.5 block text-sm font-medium text-neutral-700">Privileges</span>
          <p className="mb-2 text-xs text-neutral-500">Pick exactly what this role can see and do.</p>

          {loadingPermissions && (
            <div className="flex flex-col gap-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          )}

          {!loadingPermissions && permissionsError && (
            <p className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
              {permissionsError}
            </p>
          )}

          {!loadingPermissions && !permissionsError && (
            <div className="flex flex-col gap-4">
              {PERMISSION_CATEGORIES.map((category) => {
                const codesInCatalog = category.codes.filter((code) => knownCodes.has(code))
                if (codesInCatalog.length === 0) return null
                return (
                  <div key={category.label}>
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      {category.label}
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {codesInCatalog.map((code) => (
                        <label
                          key={code}
                          className="flex cursor-pointer items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(code)}
                            onChange={() => toggle(code)}
                            className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                          />
                          {formatPermissionName(code)}
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <FormError message={formError} />
      </form>
    </Modal>
  )
}
