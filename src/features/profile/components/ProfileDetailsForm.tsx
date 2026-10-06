import { zodResolver } from '@hookform/resolvers/zod'
import { useContext, useState } from 'react'
import { useForm, type UseFormSetError } from 'react-hook-form'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { TextField } from '@/components/TextField'
import { useToast } from '@/components/useToast'
import { profileApi } from '@/features/profile/api/profileApi'
import {
  profileDetailsDefaults,
  profileDetailsSchema,
  toUpdateProfilePayload,
  type ProfileDetailsFormValues,
} from '@/features/profile/schemas'
import { EmailVerificationContext } from '@/features/profile/context/EmailVerificationContext'
import { verifiableEmailAddress, type Profile } from '@/features/profile/types'
import { isAppError } from '@/types/api'

export interface ProfileDetailsFormProps {
  profile: Profile
  onUpdated: (profile: Profile) => void
}

const FIELD_KEYS = ['firstName', 'lastName', 'email', 'phone', 'jobTitle'] as const

/**
 * Validation messages come back as "<fieldName> <constraint message>", joined by "; ".
 * Anything that maps to a field is shown on that field; the rest goes to the form-level error.
 */
function applyBackendErrors(message: string, setError: UseFormSetError<ProfileDetailsFormValues>): string | null {
  const leftovers: string[] = []

  for (const part of message.split('; ')) {
    const field = FIELD_KEYS.find((key) => part.startsWith(`${key} `))
    if (!field) {
      leftovers.push(part)
      continue
    }
    const detail = part.slice(field.length + 1)
    setError(field, { message: detail.charAt(0).toUpperCase() + detail.slice(1) })
  }

  return leftovers.length > 0 ? leftovers.join('; ') : null
}

export function ProfileDetailsForm({ profile, onUpdated }: ProfileDetailsFormProps) {
  const { showToast } = useToast()
  // Optional: the shell banner's state, refreshed when the address changes so it shows the new one.
  const verification = useContext(EmailVerificationContext)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileDetailsFormValues>({
    resolver: zodResolver(profileDetailsSchema),
    defaultValues: profileDetailsDefaults(profile),
  })

  async function onSubmit(values: ProfileDetailsFormValues) {
    setFormError(null)
    try {
      // PUT /api/me replaces the profile — toUpdateProfilePayload always sends all five fields.
      const updated = await profileApi.update(toUpdateProfilePayload(values))
      onUpdated(updated)
      reset(profileDetailsDefaults(updated))
      // A new address gets its confirmation link automatically (the server sends it with the
      // save), so say where to look instead of leaving the user to find a resend button.
      const before = verifiableEmailAddress(profile)
      const after = verifiableEmailAddress(updated)
      if (after && after.toLowerCase() !== before?.toLowerCase() && !updated.emailVerified) {
        showToast(`Profile updated. Check ${after} for a link to confirm it.`, 'success')
        verification?.refresh()
      } else {
        showToast('Profile updated.', 'success')
      }
    } catch (err) {
      if (isAppError(err) && err.status === 400) {
        setFormError(applyBackendErrors(err.message, setError))
        return
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
        <h2 className="text-base font-semibold text-neutral-900">Your details</h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          How your name shows up across Procurepaddy. Leave a field empty to clear it.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label="First name" error={errors.firstName?.message} {...register('firstName')} />
        <TextField label="Last name" error={errors.lastName?.message} {...register('lastName')} />
      </div>
      <TextField label="Email" type="email" error={errors.email?.message} {...register('email')} />
      <TextField label="Phone" type="tel" error={errors.phone?.message} {...register('phone')} />
      <TextField label="Job title" error={errors.jobTitle?.message} {...register('jobTitle')} />

      <FormError message={formError} />

      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>
          Save changes
        </Button>
      </div>
    </form>
  )
}
