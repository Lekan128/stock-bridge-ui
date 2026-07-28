import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { Modal } from '@/components/Modal'
import { TextField } from '@/components/TextField'
import { superAdminApiClient } from '@/features/admin/api/superAdminApi'
import { AdminRoleSelectField } from '@/features/admin/components/AdminRoleSelectField'
import type { SuperAdminUserSummary } from '@/features/admin/types'
import { formatDisplayName } from '@/features/users/formatters'
import { editUserSchema, type EditUserFormValues } from '@/features/users/schemas'
import type { UpdateUserPayload } from '@/features/users/types'
import { isAppError } from '@/types/api'

export interface EditPlatformOwnerUserModalProps {
  user: SuperAdminUserSummary
  onClose: () => void
  onSuccess: (user: SuperAdminUserSummary) => void
}

const ROOT_HINT = "The account owner's role and status can't be changed"

/**
 * Edits one of ProcurePal's own users.
 *
 * The root user's role and status controls are disabled rather than left live: the backend
 * answers 409 to both a demotion and a deactivation, and clicking through to an error nobody can
 * act on is worse than not offering the control. Their profile details are still editable, and
 * their password can still be reset from the actions menu — that is the lockout-recovery path.
 *
 * Unlike the tenant-side EditUserModal there is no "you can't edit yourself" case: a super admin
 * authenticates out of a different table and can never be one of these users.
 */
export function EditPlatformOwnerUserModal({ user, onClose, onSuccess }: EditPlatformOwnerUserModalProps) {
  const isRoot = user.root
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

  // PUT patches: an omitted key is left alone, a blank string clears the stored value. Only
  // touched fields are sent, so nothing the admin didn't edit can be lost.
  async function onSubmit(values: EditUserFormValues) {
    setFormError(null)

    const payload: UpdateUserPayload = {}
    if (!isRoot && dirtyFields.role) payload.role = values.role
    if (!isRoot && dirtyFields.active) payload.active = values.active
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
      const updated = await superAdminApiClient.updatePlatformOwnerUser(user.id, payload)
      onSuccess(updated)
    } catch (err) {
      // 409 here is "ProcurePal would be left without an active OWNER" (or the root guards, which
      // the disabled controls above already prevent). The server's sentence says which.
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
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
            <span>
              <span className="font-medium text-neutral-700">
                {user.username} is ProcurePal&apos;s account owner.
              </span>{' '}
              {ROOT_HINT}, but their profile details can still be updated and their password can be
              reset.
            </span>
          </p>
        )}

        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <AdminRoleSelectField
              value={field.value}
              onChange={field.onChange}
              disabled={isRoot}
              disabledHint={isRoot ? ROOT_HINT : undefined}
              error={errors.role?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <div title={isRoot ? ROOT_HINT : undefined}>
              <span className="mb-1.5 block text-sm font-medium text-neutral-700">Status</span>
              <button
                type="button"
                role="switch"
                aria-checked={field.value}
                aria-label="Active"
                disabled={isRoot}
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
              {isRoot && <p className="mt-1.5 text-xs text-neutral-500">{ROOT_HINT}</p>}
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
