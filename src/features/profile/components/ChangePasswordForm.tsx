import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { TextField } from '@/components/TextField'
import { useToast } from '@/components/useToast'
import { profileApi } from '@/features/profile/api/profileApi'
import {
  changePasswordDefaults,
  changePasswordSchema,
  type ChangePasswordFormValues,
} from '@/features/profile/schemas'
import { isAppError } from '@/types/api'

export function ChangePasswordForm() {
  const { showToast } = useToast()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: changePasswordDefaults(),
  })

  async function onSubmit(values: ChangePasswordFormValues) {
    setFormError(null)
    try {
      await profileApi.changePassword(values)
      // The current access token keeps working — the user stays signed in on purpose.
      reset(changePasswordDefaults())
      showToast('Password changed.', 'success')
    } catch (err) {
      if (isAppError(err) && err.status === 400) {
        if (err.message.toLowerCase().includes('current password')) {
          setError('currentPassword', { message: err.message })
          return
        }
        if (err.message.toLowerCase().includes('confirmation')) {
          setError('confirmNewPassword', { message: err.message })
          return
        }
      }
      setFormError(isAppError(err) ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-5"
    >
      <div>
        <h2 className="text-base font-semibold text-neutral-900">Password</h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          You'll stay signed in here; the new password applies the next time you log in.
        </p>
      </div>

      <TextField
        label="Current password"
        type="password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />
      <TextField
        label="New password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters"
        error={errors.newPassword?.message}
        {...register('newPassword')}
      />
      <TextField
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        error={errors.confirmNewPassword?.message}
        {...register('confirmNewPassword')}
      />

      <FormError message={formError} />

      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>
          Change password
        </Button>
      </div>
    </form>
  )
}
