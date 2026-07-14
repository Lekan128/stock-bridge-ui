import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { Modal } from '@/components/Modal'
import { usersApi } from '@/features/users/api/usersApi'
import { RoleSelectField } from '@/features/users/components/RoleSelectField'
import { editUserSchema, type EditUserFormValues } from '@/features/users/schemas'
import type { TenantUserSummary } from '@/features/users/types'
import { isAppError } from '@/types/api'

export interface EditUserModalProps {
  user: TenantUserSummary
  onClose: () => void
  onSuccess: (user: TenantUserSummary) => void
}

const SELF_HINT = "You can't change your own role or status"

export function EditUserModal({ user, onClose, onSuccess }: EditUserModalProps) {
  const { user: currentUser } = useAuth()
  const isSelf = currentUser?.type === 'tenant' && currentUser.id === user.id
  const [formError, setFormError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: { role: user.role, active: user.active },
  })

  async function onSubmit(values: EditUserFormValues) {
    setFormError(null)
    try {
      const updated = await usersApi.update(user.id, { role: values.role, active: values.active })
      onSuccess(updated)
    } catch (err) {
      setFormError(isAppError(err) ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${user.username}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting} disabled={isSelf}>
            Save changes
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {isSelf && (
          <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
            {SELF_HINT}.
          </p>
        )}
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <RoleSelectField
              value={field.value}
              onChange={field.onChange}
              disabled={isSelf}
              disabledHint={SELF_HINT}
            />
          )}
        />
        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <div title={isSelf ? SELF_HINT : undefined}>
              <span className="mb-1.5 block text-sm font-medium text-neutral-700">Status</span>
              <button
                type="button"
                role="switch"
                aria-checked={field.value}
                disabled={isSelf}
                onClick={() => field.onChange(!field.value)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  field.value ? 'bg-accent-600' : 'bg-neutral-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    field.value ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="ml-2 align-middle text-sm text-neutral-700">{field.value ? 'Active' : 'Inactive'}</span>
            </div>
          )}
        />
        <FormError message={formError} />
      </form>
    </Modal>
  )
}
