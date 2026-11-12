import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { Sheet } from '@/components/Sheet'
import { PasswordField } from '@/components/PasswordField'
import { usersApi } from '@/features/users/api/usersApi'
import { resetPasswordFormDefaults, resetPasswordSchema, type ResetPasswordFormValues } from '@/features/users/schemas'
import type { TenantUserSummary } from '@/features/users/types'
import { isAppError } from '@/types/api'

export interface ResetPasswordModalProps {
  user: TenantUserSummary
  onClose: () => void
  onSuccess: () => void
}

export function ResetPasswordModal({ user, onClose, onSuccess }: ResetPasswordModalProps) {
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: resetPasswordFormDefaults(),
  })

  async function onSubmit(values: ResetPasswordFormValues) {
    setFormError(null)
    try {
      await usersApi.resetPassword(user.id, values)
      onSuccess()
    } catch (err) {
      setFormError(isAppError(err) ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Reset password for ${user.username}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="action" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            Reset password
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <PasswordField
          label="New password"
          autoComplete="new-password"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <PasswordField
          label="Confirm new password"
          autoComplete="new-password"
          error={errors.confirmNewPassword?.message}
          {...register('confirmNewPassword')}
        />
        <FormError message={formError} />
      </form>
    </Sheet>
  )
}
