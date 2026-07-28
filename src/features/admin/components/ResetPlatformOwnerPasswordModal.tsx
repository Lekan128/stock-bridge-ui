import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { Modal } from '@/components/Modal'
import { TextField } from '@/components/TextField'
import { superAdminApiClient } from '@/features/admin/api/superAdminApi'
import type { SuperAdminUserSummary } from '@/features/admin/types'
import { resetPasswordFormDefaults, resetPasswordSchema, type ResetPasswordFormValues } from '@/features/users/schemas'
import { isAppError } from '@/types/api'

export interface ResetPlatformOwnerPasswordModalProps {
  user: SuperAdminUserSummary
  onClose: () => void
  onSuccess: () => void
}

/**
 * Sets a new password on a ProcurePal user — including the root user, unlike the tenant-side
 * equivalent, which blocks that case. This is the deliberate lockout-recovery path: a super
 * admin who cannot reset ProcurePal's root credentials has no way back in, and they can already
 * suspend the tenant and read every tenant's data, so there is no privilege being escalated.
 */
export function ResetPlatformOwnerPasswordModal({ user, onClose, onSuccess }: ResetPlatformOwnerPasswordModalProps) {
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
      await superAdminApiClient.resetPlatformOwnerUserPassword(user.id, values)
      onSuccess()
    } catch (err) {
      setFormError(isAppError(err) ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Reset password for ${user.username}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            Reset password
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {user.root && (
          <p className="flex items-start gap-2 rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-700">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              This is ProcurePal&apos;s account owner. Whoever holds the old password loses access
              the moment this is saved — make sure the new one reaches them.
            </span>
          </p>
        )}
        <TextField
          label="New password"
          type="password"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <TextField
          label="Confirm new password"
          type="password"
          error={errors.confirmNewPassword?.message}
          {...register('confirmNewPassword')}
        />
        <FormError message={formError} />
      </form>
    </Modal>
  )
}
