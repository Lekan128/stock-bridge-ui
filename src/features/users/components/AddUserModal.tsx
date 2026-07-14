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
      const user = await usersApi.create({ username: values.username, password: values.password, role: values.role })
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
          hint="Can be an email or any username — this is what they'll use to log in along with your client ID"
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
          render={({ field }) => <RoleSelectField value={field.value} onChange={field.onChange} />}
        />
        <FormError message={formError} />
      </form>
    </Modal>
  )
}
