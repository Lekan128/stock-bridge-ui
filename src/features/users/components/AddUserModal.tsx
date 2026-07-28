import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { Modal } from '@/components/Modal'
import { TextField } from '@/components/TextField'
import { usersApi } from '@/features/users/api/usersApi'
import { RoleSelectField } from '@/features/users/components/RoleSelectField'
import { createUserFormDefaults, createUserSchema, type CreateUserFormValues } from '@/features/users/schemas'
import type { TenantUserSummary } from '@/features/users/types'
import { isAppError } from '@/types/api'

export interface AddUserModalProps {
  onClose: () => void
  onSuccess: (user: TenantUserSummary) => void
}

/** Optional profile fields are only sent when filled in — the backend stores blanks as null anyway. */
function optional(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

export function AddUserModal({ onClose, onSuccess }: AddUserModalProps) {
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: createUserFormDefaults(),
  })

  async function onSubmit(values: CreateUserFormValues) {
    setFormError(null)
    try {
      const user = await usersApi.create({
        username: values.username,
        password: values.password,
        role: values.role,
        firstName: optional(values.firstName),
        lastName: optional(values.lastName),
        email: optional(values.email),
        phone: optional(values.phone),
        jobTitle: optional(values.jobTitle),
      })
      onSuccess(user)
    } catch (err) {
      if (isAppError(err) && err.status === 409) {
        setError('username', { message: err.message })
        return
      }
      setFormError(isAppError(err) ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add user"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            Add user
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <TextField
          label="Username"
          hint="Can be an email or any username — this is what they'll use to log in along with your Company ID"
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
            <RoleSelectField value={field.value} onChange={field.onChange} error={errors.role?.message} />
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
