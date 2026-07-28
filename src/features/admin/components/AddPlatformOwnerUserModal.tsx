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
import { createUserFormDefaults, createUserSchema, type CreateUserFormValues } from '@/features/users/schemas'
import { isAppError } from '@/types/api'

export interface AddPlatformOwnerUserModalProps {
  /**
   * True when ProcurePal has no users at all. The backend then makes whoever is created the
   * root user and forces their role to OWNER whatever the body asked for, so the form says so
   * up front instead of letting an ops user pick STOREKEEPER and be quietly overruled.
   */
  isFirstUser: boolean
  onClose: () => void
  onSuccess: (user: SuperAdminUserSummary) => void
}

/** Optional profile fields are only sent when filled in — the backend stores blanks as null anyway. */
function optional(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

export function AddPlatformOwnerUserModal({ isFirstUser, onClose, onSuccess }: AddPlatformOwnerUserModalProps) {
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    // Pre-selecting OWNER for the first account keeps the form's own validation satisfied
    // without pretending the choice was ever open.
    defaultValues: { ...createUserFormDefaults(), role: isFirstUser ? 'OWNER' : '' },
  })

  async function onSubmit(values: CreateUserFormValues) {
    setFormError(null)
    try {
      const user = await superAdminApiClient.createPlatformOwnerUser({
        username: values.username,
        password: values.password,
        role: values.role,
        firstName: optional(values.firstName),
        lastName: optional(values.lastName),
        email: optional(values.email),
        phone: optional(values.phone),
        jobTitle: optional(values.jobTitle),
      })
      // The caller renders `user`, never `values` — for the first account the role that came
      // back is the one that was actually created, which may not be the one that was asked for.
      onSuccess(user)
    } catch (err) {
      if (isAppError(err) && err.status === 409) {
        // 409 here is either a taken username or — on a deployment where ProcurePal was never
        // bootstrapped — the missing-tenant precondition. Only the first belongs on a field.
        if (err.message.toLowerCase().includes('username')) {
          setError('username', { message: err.message })
          return
        }
        setFormError(err.message)
        return
      }
      setFormError(isAppError(err) ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isFirstUser ? "Create ProcurePal's account owner" : 'Add ProcurePal user'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            {isFirstUser ? 'Create account owner' : 'Add user'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {isFirstUser && (
          <p className="flex items-start gap-2 rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-700">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-medium">This will be ProcurePal&apos;s account owner.</span> It is the
              first user in the tenant, so it is created as the root account with the Owner role
              whichever role is chosen. Its role can never be changed and it can never be
              deactivated — only its password can be reset.
            </span>
          </p>
        )}

        <TextField
          label="Username"
          hint="Can be an email or any username — this is what they'll use to log in, alongside ProcurePal's company ID."
          error={errors.username?.message}
          {...register('username')}
        />
        <TextField label="Password" type="password" error={errors.password?.message} {...register('password')} />
        <TextField
          label="Confirm password"
          type="password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <AdminRoleSelectField
              value={field.value}
              onChange={field.onChange}
              disabled={isFirstUser}
              disabledHint={isFirstUser ? 'The first ProcurePal account is always the Owner' : undefined}
              error={errors.role?.message}
            />
          )}
        />

        <div className="border-t border-neutral-200 pt-4">
          <p className="text-sm font-medium text-neutral-700">Profile details</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            All optional — they can fill these in themselves from their profile page later.
          </p>
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
