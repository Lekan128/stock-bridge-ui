import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { Modal } from '@/components/Modal'
import { TextField } from '@/components/TextField'
import { usersApi } from '@/features/users/api/usersApi'
import { RoleSelectField } from '@/features/users/components/RoleSelectField'
import { formatDisplayName } from '@/features/users/formatters'
import { editUserSchema, type EditUserFormValues } from '@/features/users/schemas'
import type { TenantUserSummary, UpdateUserPayload } from '@/features/users/types'
import { isAppError } from '@/types/api'

export interface EditUserModalProps {
  user: TenantUserSummary
  onClose: () => void
  onSuccess: (user: TenantUserSummary) => void
}

const SELF_HINT = "You can't change your own role or status"
const ROOT_HINT = "The account owner's role and status can't be changed"

export function EditUserModal({ user, onClose, onSuccess }: EditUserModalProps) {
  const { user: currentUser } = useAuth()
  const isSelf = currentUser?.type === 'tenant' && currentUser.id === user.id
  const isRoot = user.root
  const lockAccess = isSelf || isRoot
  const lockHint = isRoot ? ROOT_HINT : SELF_HINT
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      role: user.role,
      active: user.active,
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      email: user.email ?? '',
      phone: user.phone ?? '',
      jobTitle: user.jobTitle ?? '',
    },
  })

  // PUT /api/users/{id} patches: an omitted key is left alone, and a blank string clears the
  // stored value. So only touched fields are sent — nothing the admin didn't edit can be lost,
  // and role/active are never sent for the account owner or for the admin's own row.
  async function onSubmit(values: EditUserFormValues) {
    setFormError(null)

    const payload: UpdateUserPayload = {}
    if (!lockAccess && dirtyFields.role) payload.role = values.role
    if (!lockAccess && dirtyFields.active) payload.active = values.active
    if (dirtyFields.firstName) payload.firstName = values.firstName.trim()
    if (dirtyFields.lastName) payload.lastName = values.lastName.trim()
    if (dirtyFields.email) payload.email = values.email.trim()
    if (dirtyFields.phone) payload.phone = values.phone.trim()
    if (dirtyFields.jobTitle) payload.jobTitle = values.jobTitle.trim()

    if (Object.keys(payload).length === 0) {
      onClose()
      return
    }

    try {
      const updated = await usersApi.update(user.id, payload)
      onSuccess(updated)
    } catch (err) {
      setFormError(isAppError(err) ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${formatDisplayName(user)}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            Save changes
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {isRoot && (
          <p className="flex items-start gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
            <span>
              <span className="font-medium text-neutral-700">{user.username} is the account owner.</span> {ROOT_HINT},
              but their profile details can still be updated.
            </span>
          </p>
        )}
        {!isRoot && isSelf && (
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
              disabled={lockAccess}
              disabledHint={lockAccess ? lockHint : undefined}
              error={errors.role?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <div title={lockAccess ? lockHint : undefined}>
              <span className="mb-1.5 block text-sm font-medium text-neutral-700">Status</span>
              <button
                type="button"
                role="switch"
                aria-checked={field.value}
                aria-label="Active"
                disabled={lockAccess}
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
              {lockAccess && <p className="mt-1.5 text-xs text-neutral-500">{lockHint}</p>}
            </div>
          )}
        />

        <div className="border-t border-neutral-200 pt-4">
          <p className="text-sm font-medium text-neutral-700">Profile details</p>
          <p className="mt-0.5 text-xs text-neutral-500">Leave a field empty to clear it.</p>
          <div className="mt-3 flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField label="First name" error={errors.firstName?.message} {...register('firstName')} />
              <TextField label="Last name" error={errors.lastName?.message} {...register('lastName')} />
            </div>
            <TextField label="Email" type="email" error={errors.email?.message} {...register('email')} />
            <TextField label="Phone" type="tel" error={errors.phone?.message} {...register('phone')} />
            <TextField label="Job title" error={errors.jobTitle?.message} {...register('jobTitle')} />
          </div>
        </div>

        <FormError message={formError} />
      </form>
    </Modal>
  )
}
