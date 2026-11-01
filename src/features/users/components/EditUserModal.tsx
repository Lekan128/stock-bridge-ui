import { zodResolver } from '@hookform/resolvers/zod'
import { useWatch } from 'react-hook-form'
import { WorksAtField } from '@/features/branches/WorksAtField'
import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { Sheet } from '@/components/Sheet'
import { TextField } from '@/components/TextField'
import { usersApi } from '@/features/users/api/usersApi'
import { RoleSelectField } from '@/features/users/components/RoleSelectField'
import { formatDisplayName } from '@/features/users/formatters'
import { editUserSchema, type EditUserFormValues } from '@/features/users/schemas'
import type { TenantUserSummary, UpdateUserPayload } from '@/features/users/types'
import { isAppError } from '@/types/api'
import { useUsers } from '@/features/users/hooks/useUsers'
import { sharedSignInNote } from '@/features/users/sharedSignIn'

export interface EditUserModalProps {
  user: TenantUserSummary
  onClose: () => void
  onSuccess: (user: TenantUserSummary) => void
}

const SELF_HINT = "You can't change your own role or status"
const ROOT_HINT = "The account owner's role and status can't be changed"

export function EditUserModal({ user, onClose, onSuccess }: EditUserModalProps) {
  const { user: currentUser, client } = useAuth()
  const isSelf = currentUser?.type === 'tenant' && currentUser.id === user.id
  const isRoot = user.root
  const lockAccess = isSelf || isRoot
  const lockHint = isRoot ? ROOT_HINT : SELF_HINT
  const [formError, setFormError] = useState<string | null>(null)
  // Where they work (MULTI_BRANCH_UX_PLAN.md §5.10). Sent only when changed.
  const [branchIds, setBranchIds] = useState<string[]>(user.branchIds ?? [])
  const branchesChanged = [...branchIds].sort().join() !== [...(user.branchIds ?? [])].sort().join()
  // …and in which areas (STOCK_AREAS_PART_3.md). Sent only when changed; empty = every area.
  const [areaIds, setAreaIds] = useState<string[]>(user.areaIds ?? [])
  const areasChanged = [...areaIds].sort().join() !== [...(user.areaIds ?? [])].sort().join()

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      roleId: user.roleId,
      active: user.active,
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      email: user.email ?? '',
      phone: user.phone ?? '',
      jobTitle: user.jobTitle ?? '',
    },
  })
  const roleId = useWatch({ control, name: 'roleId' })
  // Everyone here, to say when an email or number typed is someone else's too (owner, 2026-11-01).
  const everyone = useUsers({ page: 0, size: 200 }).data?.content ?? []
  const [typedEmail, typedPhone, typedFirst, typedLast] = useWatch({
    control,
    name: ['email', 'phone', 'firstName', 'lastName'],
  })
  const thisPerson = {
    id: user.id,
    root: user.root,
    name: formatDisplayName({ username: user.username, firstName: typedFirst, lastName: typedLast }),
  }
  const sharedEmail = sharedSignInNote('email', typedEmail, thisPerson, everyone)
  const sharedPhone = sharedSignInNote('number', typedPhone, thisPerson, everyone)

  // PUT /api/users/{id} patches: an omitted key is left alone, and a blank string clears the
  // stored value. So only touched fields are sent — nothing the admin didn't edit can be lost,
  // and role/active are never sent for the account owner or for the admin's own row.
  async function onSubmit(values: EditUserFormValues) {
    setFormError(null)

    const payload: UpdateUserPayload = {}
    if (!lockAccess && dirtyFields.roleId) payload.roleId = values.roleId
    if (!lockAccess && dirtyFields.active) payload.active = values.active
    if (dirtyFields.firstName) payload.firstName = values.firstName.trim()
    if (dirtyFields.lastName) payload.lastName = values.lastName.trim()
    if (dirtyFields.email) payload.email = values.email.trim()
    if (dirtyFields.phone) payload.phone = values.phone.trim()
    if (dirtyFields.jobTitle) payload.jobTitle = values.jobTitle.trim()
    if (branchesChanged) payload.branchIds = branchIds
    if (areasChanged) payload.areaIds = areaIds

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
    <Sheet
      open
      onClose={onClose}
      title={`Edit ${formatDisplayName(user)}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="action" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            Save changes
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {/* What they type to sign in (owner, 2026-11-01: "the username is not even showing"): the username, or the
            email or phone below, with the Company ID. */}
        <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700" data-signs-in>
          Signs in as <span className="font-semibold text-neutral-900">{user.username}</span>
          {client?.identifier && (
            <>
              {' '}
              at <span className="font-semibold text-neutral-900">{client.identifier}</span>
            </>
          )}
          , or with the email or phone below.
        </p>
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
          name="roleId"
          render={({ field }) => (
            <RoleSelectField
              value={field.value}
              onChange={field.onChange}
              disabled={lockAccess}
              disabledHint={lockAccess ? lockHint : undefined}
              error={errors.roleId?.message}
            />
          )}
        />
        {!isRoot && (
          <WorksAtField roleId={roleId} value={branchIds} onChange={setBranchIds} areaIds={areaIds} onAreasChange={setAreaIds} />
        )}
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
              <TextField label="First name" autoComplete="off" error={errors.firstName?.message} {...register('firstName')} />
              <TextField label="Last name" autoComplete="off" error={errors.lastName?.message} {...register('lastName')} />
            </div>
            <TextField label="Email" type="email" autoComplete="off" error={errors.email?.message} {...register('email')} />
            <SharedNote text={sharedEmail} />
            <TextField label="Phone" autoComplete="off" type="tel" error={errors.phone?.message} {...register('phone')} />
            <SharedNote text={sharedPhone} />
            <TextField label="Job title" autoComplete="off" error={errors.jobTitle?.message} {...register('jobTitle')} />
          </div>
        </div>

        <FormError message={formError} />
      </form>
    </Sheet>
  )
}

/** Under Email or Phone: someone else here has it too, so it won't sign anyone in (owner, 2026-11-01). */
function SharedNote({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <p className="-mt-2 text-sm text-warning-800" data-shared-sign-in>
      {text}
    </p>
  )
}
